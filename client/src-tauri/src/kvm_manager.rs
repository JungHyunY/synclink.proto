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

#[derive(Debug, Clone, Copy)]
pub struct ScreenBounds {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
    pub width: f64,
    pub height: f64,
}

#[cfg(target_os = "windows")]
const SM_CXSCREEN: i32 = 0;
#[cfg(target_os = "windows")]
const SM_CYSCREEN: i32 = 1;
#[cfg(target_os = "windows")]
const SM_XVIRTUALSCREEN: i32 = 76;
#[cfg(target_os = "windows")]
const SM_YVIRTUALSCREEN: i32 = 77;
#[cfg(target_os = "windows")]
const SM_CXVIRTUALSCREEN: i32 = 78;
#[cfg(target_os = "windows")]
const SM_CYVIRTUALSCREEN: i32 = 79;

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

pub fn get_virtual_screen_bounds() -> ScreenBounds {
    #[cfg(target_os = "windows")]
    unsafe {
        let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let vw = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let vh = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        if vw > 0 && vh > 0 {
            return ScreenBounds {
                min_x: vx as f64,
                min_y: vy as f64,
                max_x: (vx + vw) as f64,
                max_y: (vy + vh) as f64,
                width: vw as f64,
                height: vh as f64,
            };
        }
        let w = GetSystemMetrics(SM_CXSCREEN);
        let h = GetSystemMetrics(SM_CYSCREEN);
        if w > 0 && h > 0 {
            return ScreenBounds {
                min_x: 0.0,
                min_y: 0.0,
                max_x: w as f64,
                max_y: h as f64,
                width: w as f64,
                height: h as f64,
            };
        }
    }
    #[cfg(target_os = "macos")]
    unsafe {
        let d = CGMainDisplayID();
        let w = CGDisplayPixelsWide(d);
        let h = CGDisplayPixelsHigh(d);
        if w > 0 && h > 0 {
            return ScreenBounds {
                min_x: 0.0,
                min_y: 0.0,
                max_x: w as f64,
                max_y: h as f64,
                width: w as f64,
                height: h as f64,
            };
        }
    }
    ScreenBounds {
        min_x: 0.0,
        min_y: 0.0,
        max_x: 1920.0,
        max_y: 1080.0,
        width: 1920.0,
        height: 1080.0,
    }
}

pub fn get_os_screen_size() -> (f64, f64) {
    let b = get_virtual_screen_bounds();
    (b.width, b.height)
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

            // Always query the actual OS display resolution & multi-monitor virtual screen bounds
            let bounds = get_virtual_screen_bounds();

            if let Some((cur_x, cur_y)) = get_os_cursor_pos() {
                if !is_controlling {
                    anchor_pos = None;

                    // Check if mouse hits the configured edge of the entire virtual screen (with 6px tolerance margin)
                    let edge_margin = 6.0;
                    let crossed = match dir.as_str() {
                        "right" => cur_x >= (bounds.max_x - edge_margin),
                        "left" => cur_x <= (bounds.min_x + edge_margin),
                        "top" => cur_y <= (bounds.min_y + edge_margin),
                        "bottom" => cur_y >= (bounds.max_y - edge_margin),
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
                            "right" => (bounds.max_x - 2.0, cur_y.clamp(bounds.min_y, bounds.max_y)),
                            "left" => (bounds.min_x + 2.0, cur_y.clamp(bounds.min_y, bounds.max_y)),
                            "top" => (cur_x.clamp(bounds.min_x, bounds.max_x), bounds.min_y + 2.0),
                            "bottom" => (cur_x.clamp(bounds.min_x, bounds.max_x), bounds.max_y - 2.0),
                            _ => (cur_x, cur_y),
                        };
                        anchor_pos = Some(anchor);

                        // Notify frontend
                        let norm_y = ((cur_y - bounds.min_y) / bounds.height.max(1.0)).clamp(0.0, 1.0);
                        let norm_x = ((cur_x - bounds.min_x) / bounds.width.max(1.0)).clamp(0.0, 1.0);
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
                                "right" => (bounds.max_x - 40.0).max(bounds.min_x),
                                "left" => (bounds.min_x + 40.0).min(bounds.max_x),
                                _ => cur_x,
                            };
                            let return_y = match dir.as_str() {
                                "top" => (bounds.min_y + 40.0).min(bounds.max_y),
                                "bottom" => (bounds.max_y - 40.0).max(bounds.min_y),
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
    // NOTE: On macOS, rdev::listen() crashes with SIGABRT (__TSMCheckThread: TSM must be used on main thread)
    // when invoked on background threads because it tries to translate keycodes via Carbon TSM APIs.
    // Therefore, rdev::listen is restricted to Windows where SetWindowsHookEx is thread-safe.
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
