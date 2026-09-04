#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rdev::{simulate, Button, EventType, Key};
use tauri::{command, Emitter, Window};
use screenshots::Screen; 
use std::io::Cursor;
use base64::{engine::general_purpose, Engine as _};
use std::thread;
use std::time::Duration;
use image::ColorType;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

static CAPTURE_SESSION_ID: AtomicUsize = AtomicUsize::new(0);
static CAPTURE_FPS: AtomicUsize = AtomicUsize::new(30);
static CAPTURE_QUALITY: AtomicUsize = AtomicUsize::new(50);

// --- 키보드 매핑 ---
fn str_to_key(key_str: &str) -> Option<Key> {
    match key_str.to_lowercase().as_str() {
        "enter" | "return" | "numpadenter" => Some(Key::Return),
        "backspace" => Some(Key::Backspace),
        "control" | "ctrl" | "controlleft" => Some(Key::ControlLeft),
        "controlright" => Some(Key::ControlRight),
        "shift" | "shiftleft" => Some(Key::ShiftLeft),
        "shiftright" => Some(Key::ShiftRight),
        "alt" | "altleft" => Some(Key::Alt),
        "altright" | "altgraph" => Some(Key::AltGr),
        "meta" | "metaleft" | "command" | "cmd" | "win" | "window" | "windows" | "os" => Some(Key::MetaLeft),
        "metaright" => Some(Key::MetaRight),
        "escape" | "esc" => Some(Key::Escape),
        "tab" => Some(Key::Tab),
        " " | "space" | "spacebar" => Some(Key::Space),
        "arrowup" | "up" => Some(Key::UpArrow),
        "arrowdown" | "down" => Some(Key::DownArrow),
        "arrowleft" | "left" => Some(Key::LeftArrow),
        "arrowright" | "right" => Some(Key::RightArrow),
        "delete" | "del" => Some(Key::Delete),
        "insert" | "ins" => Some(Key::Insert),
        "home" => Some(Key::Home),
        "end" => Some(Key::End),
        "pageup" => Some(Key::PageUp),
        "pagedown" => Some(Key::PageDown),
        "capslock" => Some(Key::CapsLock),
        "printscreen" | "prtscn" => Some(Key::PrintScreen),
        "scrolllock" => Some(Key::ScrollLock),
        "pause" => Some(Key::Pause),
        "numlock" => Some(Key::NumLock),

        // F1 - F12
        "f1" => Some(Key::F1),
        "f2" => Some(Key::F2),
        "f3" => Some(Key::F3),
        "f4" => Some(Key::F4),
        "f5" => Some(Key::F5),
        "f6" => Some(Key::F6),
        "f7" => Some(Key::F7),
        "f8" => Some(Key::F8),
        "f9" => Some(Key::F9),
        "f10" => Some(Key::F10),
        "f11" => Some(Key::F11),
        "f12" => Some(Key::F12),

        // Letters
        "a" | "keya" => Some(Key::KeyA),
        "b" | "keyb" => Some(Key::KeyB),
        "c" | "keyc" => Some(Key::KeyC),
        "d" | "keyd" => Some(Key::KeyD),
        "e" | "keye" => Some(Key::KeyE),
        "f" | "keyf" => Some(Key::KeyF),
        "g" | "keyg" => Some(Key::KeyG),
        "h" | "keyh" => Some(Key::KeyH),
        "i" | "keyi" => Some(Key::KeyI),
        "j" | "keyj" => Some(Key::KeyJ),
        "k" | "keyk" => Some(Key::KeyK),
        "l" | "keyl" => Some(Key::KeyL),
        "m" | "keym" => Some(Key::KeyM),
        "n" | "keyn" => Some(Key::KeyN),
        "o" | "keyo" => Some(Key::KeyO),
        "p" | "keyp" => Some(Key::KeyP),
        "q" | "keyq" => Some(Key::KeyQ),
        "r" | "keyr" => Some(Key::KeyR),
        "s" | "keys" => Some(Key::KeyS),
        "t" | "keyt" => Some(Key::KeyT),
        "u" | "keyu" => Some(Key::KeyU),
        "v" | "keyv" => Some(Key::KeyV),
        "w" | "keyw" => Some(Key::KeyW),
        "x" | "keyx" => Some(Key::KeyX),
        "y" | "keyy" => Some(Key::KeyY),
        "z" | "keyz" => Some(Key::KeyZ),

        // Digits
        "1" | "digit1" | "numpad1" => Some(Key::Num1),
        "2" | "digit2" | "numpad2" => Some(Key::Num2),
        "3" | "digit3" | "numpad3" => Some(Key::Num3),
        "4" | "digit4" | "numpad4" => Some(Key::Num4),
        "5" | "digit5" | "numpad5" => Some(Key::Num5),
        "6" | "digit6" | "numpad6" => Some(Key::Num6),
        "7" | "digit7" | "numpad7" => Some(Key::Num7),
        "8" | "digit8" | "numpad8" => Some(Key::Num8),
        "9" | "digit9" | "numpad9" => Some(Key::Num9),
        "0" | "digit0" | "numpad0" => Some(Key::Num0),

        // Symbols & Punctuations
        "." | "period" | "numpaddecimal" => Some(Key::Dot),
        "," | "comma" => Some(Key::Comma),
        "-" | "minus" | "numpadsubtract" | "_" => Some(Key::Minus),
        "=" | "equal" | "numpadadd" | "+" => Some(Key::Equal),
        "/" | "slash" | "numpaddivide" | "?" => Some(Key::Slash),
        "\\" | "backslash" | "|" => Some(Key::BackSlash),
        ";" | "semicolon" | ":" => Some(Key::SemiColon),
        "'" | "quote" | "\"" => Some(Key::Quote),
        "[" | "bracketleft" | "{" => Some(Key::LeftBracket),
        "]" | "bracketright" | "}" => Some(Key::RightBracket),
        "`" | "backquote" | "~" => Some(Key::BackQuote),

        // Korean specific keys (한영, 한자)
        "hangulmode" | "kana" => Some(Key::AltGr),
        "hanjamode" => Some(Key::ControlRight),

        _ => None,
    }
}

#[command]
fn get_machine_id() -> String {
    let raw_uid = {
        #[cfg(target_os = "windows")]
        {
            let output = std::process::Command::new("reg")
                .args(["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"])
                .output()
                .ok();
            
            if let Some(out) = output {
                let text = String::from_utf8_lossy(&out.stdout);
                text.lines()
                    .find(|line| line.contains("MachineGuid"))
                    .and_then(|line| line.split_whitespace().last())
                    .map(|s| s.to_string())
                    .unwrap_or_default()
            } else {
                String::new()
            }
        }
        #[cfg(target_os = "macos")]
        {
            let output = std::process::Command::new("ioreg")
                .args(["-rd1", "-c", "IOPlatformExpertDevice"])
                .output()
                .ok();
            if let Some(out) = output {
                let text = String::from_utf8_lossy(&out.stdout);
                text.lines()
                    .find(|line| line.contains("IOPlatformUUID"))
                    .and_then(|line| line.split('"').nth(3))
                    .map(|s| s.to_string())
                    .unwrap_or_default()
            } else {
                String::new()
            }
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            String::new()
        }
    };

    let seed_string = if !raw_uid.trim().is_empty() {
        raw_uid
    } else {
        let user = std::env::var("USERNAME").or_else(|_| std::env::var("USER")).unwrap_or_else(|_| "user".to_string());
        let host = std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")).unwrap_or_else(|_| "host".to_string());
        format!("{}-{}", host, user)
    };

    let mut hasher = DefaultHasher::new();
    seed_string.hash(&mut hasher);
    let hash_val = hasher.finish();
    let nine_digit_id = 100_000_000 + (hash_val % 900_000_000);
    nine_digit_id.to_string()
}

#[command]
fn get_device_name() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Ok(name) = std::env::var("COMPUTERNAME") {
            let trimmed = name.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("scutil").args(["--get", "ComputerName"]).output() {
            if output.status.success() {
                let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !name.is_empty() {
                    return name;
                }
            }
        }
        if let Ok(output) = std::process::Command::new("hostname").output() {
            if output.status.success() {
                let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !name.is_empty() {
                    return name;
                }
            }
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Ok(output) = std::process::Command::new("hostname").output() {
            if output.status.success() {
                let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !name.is_empty() {
                    return name;
                }
            }
        }
    }
    "Desktop PC".to_string()
}

#[derive(serde::Serialize)]
struct MonitorInfo {
    index: usize,
    name: String,
    width: u32,
    height: u32,
    is_primary: bool,
}

#[command]
fn get_monitors() -> Vec<MonitorInfo> {
    let screens = Screen::all().unwrap_or_default();
    screens.iter().enumerate().map(|(idx, s)| {
        MonitorInfo {
            index: idx,
            name: format!("Display {}", idx + 1),
            width: s.display_info.width,
            height: s.display_info.height,
            is_primary: s.display_info.is_primary,
        }
    }).collect()
}

#[command]
fn remote_mouse_move(x: f64, y: f64, monitor_index: usize) {
    let screens = Screen::all().unwrap_or_default();
    let screen = screens.get(monitor_index).or(screens.first());

    if let Some(s) = screen {
        let info = s.display_info;
        
        let offset_x = info.x as f64;
        let offset_y = info.y as f64;
        let width = info.width as f64;
        let height = info.height as f64;

        let target_x = offset_x + (x * width);
        let target_y = offset_y + (y * height);

        let res = simulate(&EventType::MouseMove { x: target_x, y: target_y });
        if let Err(e) = res {
            eprintln!("⚠️ rdev MouseMove error ({:.1}, {:.1}): {:?}", target_x, target_y, e);
        }
    }
}

#[command]
fn remote_mouse_click(button: String, x: Option<f64>, y: Option<f64>, monitor_index: Option<usize>) {
    if let (Some(px), Some(py)) = (x, y) {
        remote_mouse_move(px, py, monitor_index.unwrap_or(0));
        thread::sleep(Duration::from_millis(20));
    }

    let btn = match button.as_str() {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    };
    
    // 1. 누른다
    if let Err(e) = simulate(&EventType::ButtonPress(btn)) {
        eprintln!("⚠️ rdev ButtonPress error: {:?}", e);
    }
    
    // 2. 0.05초 대기 (OS가 인식할 시간을 줌)
    thread::sleep(Duration::from_millis(50));
    
    // 3. 뗀다
    if let Err(e) = simulate(&EventType::ButtonRelease(btn)) {
        eprintln!("⚠️ rdev ButtonRelease error: {:?}", e);
    }
}

#[command]
fn remote_mouse_down(button: String, x: Option<f64>, y: Option<f64>, monitor_index: Option<usize>) {
    if let (Some(px), Some(py)) = (x, y) {
        remote_mouse_move(px, py, monitor_index.unwrap_or(0));
    }
    let btn = match button.as_str() {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    };
    if let Err(e) = simulate(&EventType::ButtonPress(btn)) {
        eprintln!("⚠️ rdev ButtonPress error: {:?}", e);
    }
}

#[command]
fn remote_mouse_up(button: String, x: Option<f64>, y: Option<f64>, monitor_index: Option<usize>) {
    if let (Some(px), Some(py)) = (x, y) {
        remote_mouse_move(px, py, monitor_index.unwrap_or(0));
    }
    let btn = match button.as_str() {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    };
    if let Err(e) = simulate(&EventType::ButtonRelease(btn)) {
        eprintln!("⚠️ rdev ButtonRelease error: {:?}", e);
    }
}

#[command]
fn remote_keyboard_event(state: String, key: String, code: Option<String>) {
    let rdev_key = str_to_key(&key).or_else(|| {
        code.as_deref().and_then(str_to_key)
    });

    if let Some(k) = rdev_key {
        let event = match state.as_str() {
            "down" => EventType::KeyPress(k),
            "up" => EventType::KeyRelease(k),
            _ => return,
        };
        let _ = simulate(&event);
    }
}

#[command]
fn remote_shortcut(keys: Vec<String>) {
    let mut pressed = Vec::new();
    for k_str in &keys {
        if let Some(k) = str_to_key(k_str) {
            let _ = simulate(&EventType::KeyPress(k));
            pressed.push(k);
            thread::sleep(Duration::from_millis(20));
        }
    }
    thread::sleep(Duration::from_millis(50));
    for k in pressed.into_iter().rev() {
        let _ = simulate(&EventType::KeyRelease(k));
        thread::sleep(Duration::from_millis(20));
    }
}

#[command]
fn update_capture_settings(fps: Option<u32>, quality: Option<u8>) {
    if let Some(f) = fps {
        let clamped_fps = f.clamp(10, 60) as usize;
        CAPTURE_FPS.store(clamped_fps, Ordering::Relaxed);
        println!("⚙️ Updated capture FPS to: {}", clamped_fps);
    }
    if let Some(q) = quality {
        let clamped_q = q.clamp(10, 100) as usize;
        CAPTURE_QUALITY.store(clamped_q, Ordering::Relaxed);
        println!("⚙️ Updated capture quality to: {}", clamped_q);
    }
}

#[command]
async fn start_screen_capture(window: Window, monitor_index: usize, fps: Option<u32>, quality: Option<u8>) {
    if let Some(f) = fps {
        CAPTURE_FPS.store(f.clamp(10, 60) as usize, Ordering::Relaxed);
    }
    if let Some(q) = quality {
        CAPTURE_QUALITY.store(q.clamp(10, 100) as usize, Ordering::Relaxed);
    }

    let my_session_id = CAPTURE_SESSION_ID.fetch_add(1, Ordering::SeqCst) + 1;
    let initial_fps = CAPTURE_FPS.load(Ordering::Relaxed);
    let initial_quality = CAPTURE_QUALITY.load(Ordering::Relaxed);
    println!("📸 Starting capture for Monitor {} (Session {}, {} FPS, {}% Quality)", monitor_index, my_session_id, initial_fps, initial_quality);

    thread::spawn(move || {
        loop {
            let current_global_id = CAPTURE_SESSION_ID.load(Ordering::SeqCst);
            if current_global_id != my_session_id {
                println!("🛑 Capture Thread {} stopping...", my_session_id);
                break;
            }

            let start_time = std::time::Instant::now();
            let screens = Screen::all().unwrap_or_default();
            let screen = screens.get(monitor_index).or(screens.first());

            if let Some(screen) = screen {
                match screen.capture() {
                    Ok(image) => {
                        let width = image.width();
                        let height = image.height();
                        let raw_data = image.as_raw();

                        let quality = CAPTURE_QUALITY.load(Ordering::Relaxed) as u8;
                        let mut buffer = Cursor::new(Vec::new());
                        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, quality);
                        
                        match encoder.encode(raw_data, width, height, ColorType::Rgba8) {
                            Ok(_) => {
                                let b64 = general_purpose::STANDARD.encode(buffer.get_ref());
                                if let Err(_) = window.emit("video-frame", b64) {
                                    break;
                                }
                            },
                            Err(e) => println!("Encoding error: {}", e),
                        }
                    },
                    Err(e) => println!("Capture error: {}", e),
                }
            }

            let current_fps = CAPTURE_FPS.load(Ordering::Relaxed).max(10);
            let frame_target_duration = Duration::from_millis((1000 / current_fps) as u64);
            let elapsed = start_time.elapsed();
            if elapsed < frame_target_duration {
                thread::sleep(frame_target_duration - elapsed);
            }
        }
    });
}

#[command]
fn stop_screen_capture() {
    CAPTURE_SESSION_ID.fetch_add(1, Ordering::SeqCst);
    println!("🛑 Screen capture stopped via command");
}

#[command]
fn get_clipboard_text() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

#[command]
fn set_clipboard_text(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

#[command]
fn check_permissions() -> bool {
    #[cfg(target_os = "macos")]
    {
        let a11y = macos_accessibility_client::accessibility::application_is_trusted();
        let screen = unsafe { CGPreflightScreenCaptureAccess() };
        return a11y && screen;
    }
    #[cfg(not(target_os = "macos"))]
    {
        return true;
    }
}

#[command]
fn open_permission_settings(permission_type: String) {
    #[cfg(target_os = "macos")]
    {
        if permission_type == "screen" {
            unsafe {
                CGRequestScreenCaptureAccess();
            }
            // First try modern Ventura / Sonoma / Sequoia path
            let _ = std::process::Command::new("open")
                .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
                .spawn();
            let _ = std::process::Command::new("open")
                .arg("x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension")
                .spawn();
        } else {
            let _ = std::process::Command::new("open")
                .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
                .spawn();
            let _ = std::process::Command::new("open")
                .arg("x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension")
                .spawn();
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = permission_type;
    }
}

#[command]
async fn set_window_session_mode(window: Window, is_session: bool) {
    if is_session {
        let _ = window.set_resizable(true);
        let _ = window.set_maximizable(true);
        let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 800.0, height: 500.0 })));
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1280.0, height: 800.0 }));
        let _ = window.center();
    } else {
        let _ = window.set_resizable(false);
        let _ = window.set_maximizable(false);
        let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 1000.0, height: 680.0 })));
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1000.0, height: 680.0 }));
        let _ = window.center();
    }
}

#[command]
async fn minimize_host_window(window: Window) {
    let _ = window.minimize();
}

#[command]
async fn restore_host_window(window: Window) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg(target_os = "macos")]
mod mac_brightness {
    use std::ffi::CString;
    use std::sync::atomic::{AtomicU32, Ordering};

    static SAVED_BRIGHTNESS: AtomicU32 = AtomicU32::new(70);

    extern "C" {
        fn dlopen(filename: *const std::os::raw::c_char, flag: std::os::raw::c_int) -> *mut std::ffi::c_void;
        fn dlsym(handle: *mut std::ffi::c_void, symbol: *const std::os::raw::c_char) -> *mut std::ffi::c_void;
        fn dlclose(handle: *mut std::ffi::c_void) -> std::os::raw::c_int;
    }

    pub fn set_display_brightness(zero: bool) {
        unsafe {
            let path = CString::new("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices").unwrap();
            let handle = dlopen(path.as_ptr(), 1);
            if handle.is_null() {
                eprintln!("[Brightness] Failed to load DisplayServices.framework");
                return;
            }

            let set_sym = CString::new("DisplayServicesSetBrightness").unwrap();
            let set_ptr = dlsym(handle, set_sym.as_ptr());

            let get_sym = CString::new("DisplayServicesGetBrightness").unwrap();
            let get_ptr = dlsym(handle, get_sym.as_ptr());

            if !set_ptr.is_null() {
                type SetFn = unsafe extern "C" fn(u32, f32) -> i32;
                type GetFn = unsafe extern "C" fn(u32, *mut f32) -> i32;
                let set_fn: SetFn = std::mem::transmute(set_ptr);

                if zero {
                    if !get_ptr.is_null() {
                        let get_fn: GetFn = std::mem::transmute(get_ptr);
                        let mut curr: f32 = 0.7;
                        if get_fn(1, &mut curr) == 0 && curr > 0.05 {
                            SAVED_BRIGHTNESS.store((curr * 100.0) as u32, Ordering::SeqCst);
                        }
                    }
                    for d in 1..=4 {
                        set_fn(d, 0.0);
                    }
                    println!("[Brightness] Displays dimmed to 0.0 (Curtain mode ON)");
                } else {
                    let target = (SAVED_BRIGHTNESS.load(Ordering::SeqCst) as f32) / 100.0;
                    let restore_val = if target > 0.05 { target } else { 0.7 };
                    for d in 1..=4 {
                        set_fn(d, restore_val);
                    }
                    println!("[Brightness] Displays restored to {} (Curtain mode OFF)", restore_val);
                }
            } else {
                eprintln!("[Brightness] DisplayServicesSetBrightness symbol not found");
            }

            dlclose(handle);
        }
    }
}

#[cfg(target_os = "windows")]
mod win_curtain {
    use std::sync::Mutex;

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct Ramp {
        pub red: [u16; 256],
        pub green: [u16; 256],
        pub blue: [u16; 256],
    }

    static SAVED_RAMP: Mutex<Option<Ramp>> = Mutex::new(None);

    #[link(name = "user32")]
    extern "system" {
        fn GetDC(hWnd: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        fn ReleaseDC(hWnd: *mut std::ffi::c_void, hDC: *mut std::ffi::c_void) -> i32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        fn GetDeviceGammaRamp(hDC: *mut std::ffi::c_void, lpRamp: *mut std::ffi::c_void) -> i32;
        fn SetDeviceGammaRamp(hDC: *mut std::ffi::c_void, lpRamp: *const std::ffi::c_void) -> i32;
    }

    pub fn set_display_blackout(blackout: bool) {
        unsafe {
            let hdc = GetDC(std::ptr::null_mut());
            if hdc.is_null() {
                eprintln!("⚠️ Failed to get Screen DC for privacy mode");
                return;
            }

            if blackout {
                let mut current_ramp = Ramp {
                    red: [0; 256],
                    green: [0; 256],
                    blue: [0; 256],
                };
                if GetDeviceGammaRamp(hdc, &mut current_ramp as *mut _ as *mut std::ffi::c_void) != 0 {
                    if let Ok(mut saved) = SAVED_RAMP.lock() {
                        if saved.is_none() {
                            *saved = Some(current_ramp);
                        }
                    }
                }

                let black_ramp = Ramp {
                    red: [0; 256],
                    green: [0; 256],
                    blue: [0; 256],
                };
                let res = SetDeviceGammaRamp(hdc, &black_ramp as *const _ as *const std::ffi::c_void);
                println!("🔒 Windows Display Curtain Mode (Blackout): {}", res != 0);
            } else {
                let mut restored = false;
                if let Ok(mut saved) = SAVED_RAMP.lock() {
                    if let Some(orig) = saved.take() {
                        let res = SetDeviceGammaRamp(hdc, &orig as *const _ as *const std::ffi::c_void);
                        println!("🔓 Windows Display Curtain Mode restored: {}", res != 0);
                        restored = true;
                    }
                }
                if !restored {
                    let mut default_ramp = Ramp {
                        red: [0; 256],
                        green: [0; 256],
                        blue: [0; 256],
                    };
                    for i in 0..256 {
                        let val = ((i as u32 * 65535) / 255) as u16;
                        default_ramp.red[i] = val;
                        default_ramp.green[i] = val;
                        default_ramp.blue[i] = val;
                    }
                    SetDeviceGammaRamp(hdc, &default_ramp as *const _ as *const std::ffi::c_void);
                    println!("🔓 Windows Display Curtain Mode restored to default ramp");
                }
            }

            ReleaseDC(std::ptr::null_mut(), hdc);
        }
    }
}

#[command]
async fn set_privacy_mode(enabled: bool) {
    #[cfg(target_os = "macos")]
    {
        mac_brightness::set_display_brightness(enabled);
    }
    #[cfg(target_os = "windows")]
    {
        win_curtain::set_display_blackout(enabled);
    }
}

#[command]
fn get_autostart_status() -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("reg")
            .args(["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "SyncLink"])
            .output();
        if let Ok(out) = output {
            return out.status.success();
        }
        false
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let plist_path = std::path::Path::new(&home).join("Library/LaunchAgents/com.yoonikon.synclink.plist");
            return plist_path.exists();
        }
        false
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        false
    }
}

#[command]
fn set_autostart_status(enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        if enabled {
            let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_str = exe_path.to_str().ok_or("Invalid exe path")?;
            let output = std::process::Command::new("reg")
                .args(&[
                    "add",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "SyncLink",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &format!("\"{}\"", exe_str),
                    "/f"
                ])
                .output()
                .map_err(|e| e.to_string())?;
            if output.status.success() {
                println!("🚀 Autostart registered for Windows: {}", exe_str);
                Ok(true)
            } else {
                Err(String::from_utf8_lossy(&output.stderr).to_string())
            }
        } else {
            let _ = std::process::Command::new("reg")
                .args(&[
                    "delete",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "SyncLink",
                    "/f"
                ])
                .output();
            println!("🛑 Autostart unregistered for Windows");
            Ok(false)
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let agent_dir = std::path::Path::new(&home).join("Library/LaunchAgents");
            let plist_path = agent_dir.join("com.yoonikon.synclink.plist");
            if enabled {
                let _ = std::fs::create_dir_all(&agent_dir);
                let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
                let plist_content = format!(
                    r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.yoonikon.synclink</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>"#,
                    exe_path.to_string_lossy()
                );
                std::fs::write(&plist_path, plist_content).map_err(|e| e.to_string())?;
                println!("🚀 Autostart plist registered for macOS");
                Ok(true)
            } else {
                let _ = std::fs::remove_file(&plist_path);
                println!("🛑 Autostart plist removed for macOS");
                Ok(false)
            }
        } else {
            Err("HOME directory not found".to_string())
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = enabled;
        Ok(false)
    }
}

#[command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/c", "start", &url])
            .spawn();
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&url)
            .spawn();
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn();
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = url;
        Ok(())
    }
}

mod kvm_manager;

#[command]
fn enable_kvm_mode(enabled: bool, direction: String, screen_width: usize, screen_height: usize) {
    let guard = kvm_manager::KVM_STATE.lock().unwrap();
    if let Some(ref state) = *guard {
        state.is_enabled.store(enabled, std::sync::atomic::Ordering::SeqCst);
        if !enabled {
            state.is_controlling_remote.store(false, std::sync::atomic::Ordering::SeqCst);
        }
        *state.direction.lock().unwrap() = direction;
        state.screen_width.store(screen_width, std::sync::atomic::Ordering::SeqCst);
        state.screen_height.store(screen_height, std::sync::atomic::Ordering::SeqCst);
    }
}

#[command]
fn release_kvm_control() {
    kvm_manager::release_control();
}

#[command]
fn remote_mouse_move_relative(dx: f64, dy: f64) {
    if let Some((cur_x, cur_y)) = kvm_manager::get_os_cursor_pos() {
        let new_x = cur_x + dx;
        let new_y = cur_y + dy;
        let _ = simulate(&EventType::MouseMove { x: new_x, y: new_y });
    }
}

#[command]
fn remote_mouse_wheel(delta_y: i64) {
    let _ = simulate(&EventType::Wheel { delta_x: 0, delta_y });
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            kvm_manager::init_kvm(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_machine_id,
            get_device_name,
            get_monitors,
            remote_mouse_move, 
            remote_mouse_click,
            remote_keyboard_event,
            start_screen_capture,
            update_capture_settings,
            get_clipboard_text,
            set_clipboard_text,
            check_permissions,
            open_permission_settings,
            set_window_session_mode,
            set_privacy_mode,
            minimize_host_window,
            restore_host_window,
            stop_screen_capture,
            remote_shortcut,
            remote_mouse_down,
            remote_mouse_up,
            get_autostart_status,
            set_autostart_status,
            open_external_url,
            enable_kvm_mode,
            release_kvm_control,
            remote_mouse_move_relative,
            remote_mouse_wheel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}