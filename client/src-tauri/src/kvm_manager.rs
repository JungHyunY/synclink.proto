use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[repr(C)]
struct WinPoint {
    x: i32,
    y: i32,
}

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn GetCursorPos(lpPoint: *mut WinPoint) -> i32;
    fn SetCursorPos(X: i32, Y: i32) -> i32;
    fn GetSystemMetrics(nIndex: i32) -> i32;
}

#[cfg(target_os = "windows")]
const SM_CXSCREEN: i32 = 0;
#[cfg(target_os = "windows")]
const SM_CYSCREEN: i32 = 1;

#[cfg(target_os = "macos")]
#[repr(C)]
struct MacPoint {
    x: f64,
    y: f64,
}

#[cfg(target_os = "macos")]
extern "C" {
    fn CGEventCreate(source: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn CGEventGetLocation(event: *mut std::ffi::c_void) -> MacPoint;
    fn CFRelease(cf: *mut std::ffi::c_void);
    fn CGWarpMouseCursorPosition(newCursorPosition: MacPoint) -> i32;
    fn CGMainDisplayID() -> u32;
    fn CGDisplayPixelsWide(display: u32) -> usize;
    fn CGDisplayPixelsHigh(display: u32) -> usize;
}

pub fn get_os_screen_size() -> (f64, f64) {
    #[cfg(target_os = "windows")]
    unsafe {
        let w = GetSystemMetrics(SM_CXSCREEN);
        let h = GetSystemMetrics(SM_CYSCREEN);
        if w > 0 && h > 0 {
            return (w as f64, h as f64);
        }
    }
    #[cfg(target_os = "macos")]
    unsafe {
        let d = CGMainDisplayID();
        let w = CGDisplayPixelsWide(d);
        let h = CGDisplayPixelsHigh(d);
        if w > 0 && h > 0 {
            return (w as f64, h as f64);
        }
    }
    (1920.0, 1080.0)
}

pub fn get_os_cursor_pos() -> Option<(f64, f64)> {
    #[cfg(target_os = "windows")]
    unsafe {
        let mut pt = WinPoint { x: 0, y: 0 };
        if GetCursorPos(&mut pt) != 0 {
            Some((pt.x as f64, pt.y as f64))
        } else {
            None
        }
    }
    #[cfg(target_os = "macos")]
    unsafe {
        let ev = CGEventCreate(std::ptr::null_mut());
        if !ev.is_null() {
            let pt = CGEventGetLocation(ev);
            CFRelease(ev);
            Some((pt.x, pt.y))
        } else {
            None
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    None
}

pub fn set_os_cursor_pos(x: f64, y: f64) {
    #[cfg(target_os = "windows")]
    unsafe {
        SetCursorPos(x as i32, y as i32);
    }
    #[cfg(target_os = "macos")]
    unsafe {
        CGWarpMouseCursorPosition(MacPoint { x, y });
    }
}

pub struct KvmState {
    pub is_enabled: AtomicBool,
    pub is_controlling_remote: AtomicBool,
    pub direction: Mutex<String>, // "right", "left", "top", "bottom"
    pub screen_width: AtomicUsize,
    pub screen_height: AtomicUsize,
}

impl Default for KvmState {
    fn default() -> Self {
        Self {
            is_enabled: AtomicBool::new(false),
            is_controlling_remote: AtomicBool::new(false),
            direction: Mutex::new("right".to_string()),
            screen_width: AtomicUsize::new(1920),
            screen_height: AtomicUsize::new(1080),
        }
    }
}

pub static KVM_STATE: Mutex<Option<KvmState>> = Mutex::new(None);

pub fn init_kvm(app_handle: AppHandle) {
    let mut state_guard = KVM_STATE.lock().unwrap();
    if state_guard.is_some() {
        return;
    }
    *state_guard = Some(KvmState::default());
    drop(state_guard);

    // 1. Cursor Border Detection & Smooth Edge-Trapping Thread
    let app_clone = app_handle.clone();
    thread::spawn(move || {
        let mut anchor_pos: Option<(f64, f64)> = None;

        loop {
            thread::sleep(Duration::from_millis(8)); // ~125Hz polling

            let (is_enabled, is_controlling, dir) = {
                let guard = KVM_STATE.lock().unwrap();
                if let Some(ref state) = *guard {
                    (
                        state.is_enabled.load(Ordering::Relaxed),
                        state.is_controlling_remote.load(Ordering::Relaxed),
                        state.direction.lock().unwrap().clone(),
                    )
                } else {
                    continue;
                }
            };

            if !is_enabled {
                anchor_pos = None;
                continue;
            }

            // Always query the actual OS display resolution
            let (sw, sh) = get_os_screen_size();

            if let Some((cur_x, cur_y)) = get_os_cursor_pos() {
                if !is_controlling {
                    anchor_pos = None;

                    // Check if mouse hits the configured edge of the primary monitor (with 6px tolerance margin)
                    let edge_margin = 6.0;
                    let crossed = match dir.as_str() {
                        "right" => cur_x >= (sw - edge_margin),
                        "left" => cur_x <= edge_margin,
                        "top" => cur_y <= edge_margin,
                        "bottom" => cur_y >= (sh - edge_margin),
                        _ => false,
                    };

                    if crossed {
                        println!("🌊 [KVM Flow] Crossed edge to remote PC: {} ({}, {})", dir, cur_x, cur_y);
                        {
                            let guard = KVM_STATE.lock().unwrap();
                            if let Some(ref state) = *guard {
                                state.is_controlling_remote.store(true, Ordering::SeqCst);
                            }
                        }

                        // Store the edge boundary where cursor crossed
                        let anchor = match dir.as_str() {
                            "right" => (sw - 2.0, cur_y.clamp(0.0, sh)),
                            "left" => (2.0, cur_y.clamp(0.0, sh)),
                            "top" => (cur_x.clamp(0.0, sw), 2.0),
                            "bottom" => (cur_x.clamp(0.0, sw), sh - 2.0),
                            _ => (cur_x, cur_y),
                        };
                        anchor_pos = Some(anchor);

                        // Notify frontend
                        let norm_y = (cur_y / sh.max(1.0)).clamp(0.0, 1.0);
                        let norm_x = (cur_x / sw.max(1.0)).clamp(0.0, 1.0);
                        let _ = app_clone.emit("kvm-entered", serde_json::json!({
                            "direction": dir,
                            "normalizedX": norm_x,
                            "normalizedY": norm_y
                        }));
                    }
                } else {
                    // Currently controlling remote PC
                    if let Some((ax, ay)) = anchor_pos {
                        let dx = cur_x - ax;
                        let dy = cur_y - ay;

                        // Check for natural return gesture (user pulling mouse firmly back to local screen)
                        let returned = match dir.as_str() {
                            "right" => dx < -25.0, // Moving back left
                            "left" => dx > 25.0,   // Moving back right
                            "top" => dy > 25.0,    // Moving back down
                            "bottom" => dy < -25.0, // Moving back up
                            _ => false,
                        };

                        if returned {
                            println!("↩️ [KVM Flow] Mouse returned to local PC: {} (delta: {}, {})", dir, dx, dy);
                            release_control();
                            anchor_pos = None;

                            // Place cursor comfortably inside local monitor so it doesn't immediately re-cross
                            let return_x = match dir.as_str() {
                                "right" => (sw - 40.0).max(0.0),
                                "left" => 40.0,
                                _ => cur_x,
                            };
                            let return_y = match dir.as_str() {
                                "top" => 40.0,
                                "bottom" => (sh - 40.0).max(0.0),
                                _ => cur_y,
                            };
                            set_os_cursor_pos(return_x, return_y);

                            let _ = app_clone.emit("kvm-exited", ());
                            continue;
                        }

                        // Send mouse delta to remote PC
                        if dx.abs() > 0.0 || dy.abs() > 0.0 {
                            // Keep cursor silently pinned to the border anchor rather than jumping to center
                            set_os_cursor_pos(ax, ay);

                            let _ = app_clone.emit("kvm-mouse-delta", serde_json::json!({
                                "dx": dx,
                                "dy": dy
                            }));
                        }
                    } else {
                        // Fallback anchor if lost
                        anchor_pos = Some((cur_x, cur_y));
                    }
                }
            }
        }
    });

    // 2. Global Input Hook (Clicks & Keys) while controlling remote
    #[cfg(target_os = "windows")]
    {
        let app_clone_input = app_handle.clone();
        thread::spawn(move || {
            let _ = rdev::listen(move |event| {
                let is_controlling = {
                    let guard = KVM_STATE.lock().unwrap();
                    if let Some(ref state) = *guard {
                        state.is_enabled.load(Ordering::Relaxed) && state.is_controlling_remote.load(Ordering::Relaxed)
                    } else {
                        false
                    }
                };

                if !is_controlling {
                    return;
                }

                match event.event_type {
                    rdev::EventType::ButtonPress(btn) => {
                        let btn_str = match btn {
                            rdev::Button::Right => "right",
                            rdev::Button::Middle => "middle",
                            _ => "left",
                        };
                        let _ = app_clone_input.emit("kvm-mouse-button", serde_json::json!({
                            "button": btn_str,
                            "state": "down"
                        }));
                    }
                    rdev::EventType::ButtonRelease(btn) => {
                        let btn_str = match btn {
                            rdev::Button::Right => "right",
                            rdev::Button::Middle => "middle",
                            _ => "left",
                        };
                        let _ = app_clone_input.emit("kvm-mouse-button", serde_json::json!({
                            "button": btn_str,
                            "state": "up"
                        }));
                    }
                    rdev::EventType::Wheel { delta_y, .. } => {
                        let _ = app_clone_input.emit("kvm-mouse-wheel", serde_json::json!({
                            "deltaY": delta_y
                        }));
                    }
                    rdev::EventType::KeyPress(key) => {
                        // Emergency escape shortcut: Escape key
                        if key == rdev::Key::Escape {
                            println!("🛑 [KVM Flow] Emergency Escape pressed! Returning control to local PC.");
                            release_control();
                            let _ = app_clone_input.emit("kvm-exited", ());
                            return;
                        }

                        let key_str = format!("{:?}", key);
                        let _ = app_clone_input.emit("kvm-key", serde_json::json!({
                            "key": key_str,
                            "state": "down"
                        }));
                    }
                    rdev::EventType::KeyRelease(key) => {
                        let key_str = format!("{:?}", key);
                        let _ = app_clone_input.emit("kvm-key", serde_json::json!({
                            "key": key_str,
                            "state": "up"
                        }));
                    }
                    _ => {}
                }
            });
        });
    }
}

pub fn release_control() {
    let guard = KVM_STATE.lock().unwrap();
    if let Some(ref state) = *guard {
        state.is_controlling_remote.store(false, Ordering::SeqCst);
    }
}
