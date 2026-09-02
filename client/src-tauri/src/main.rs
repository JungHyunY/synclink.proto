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

static CAPTURE_SESSION_ID: AtomicUsize = AtomicUsize::new(0);
static CAPTURE_FPS: AtomicUsize = AtomicUsize::new(30);
static CAPTURE_QUALITY: AtomicUsize = AtomicUsize::new(50);

// --- 키보드 매핑 ---
fn str_to_key(key_str: &str) -> Option<Key> {
    match key_str.to_lowercase().as_str() {
        "enter" => Some(Key::Return),
        "backspace" => Some(Key::Backspace),
        "control" => Some(Key::ControlLeft),
        "shift" => Some(Key::ShiftLeft),
        "alt" => Some(Key::Alt),
        "escape" => Some(Key::Escape),
        "tab" => Some(Key::Tab),
        "space" => Some(Key::Space),
        "arrowup" => Some(Key::UpArrow),
        "arrowdown" => Some(Key::DownArrow),
        "arrowleft" => Some(Key::LeftArrow),
        "arrowright" => Some(Key::RightArrow),
        "a" => Some(Key::KeyA), "b" => Some(Key::KeyB), "c" => Some(Key::KeyC),
        "d" => Some(Key::KeyD), "e" => Some(Key::KeyE), "f" => Some(Key::KeyF),
        "g" => Some(Key::KeyG), "h" => Some(Key::KeyH), "i" => Some(Key::KeyI),
        "j" => Some(Key::KeyJ), "k" => Some(Key::KeyK), "l" => Some(Key::KeyL),
        "m" => Some(Key::KeyM), "n" => Some(Key::KeyN), "o" => Some(Key::KeyO),
        "p" => Some(Key::KeyP), "q" => Some(Key::KeyQ), "r" => Some(Key::KeyR),
        "s" => Some(Key::KeyS), "t" => Some(Key::KeyT), "u" => Some(Key::KeyU),
        "v" => Some(Key::KeyV), "w" => Some(Key::KeyW), "x" => Some(Key::KeyX),
        "y" => Some(Key::KeyY), "z" => Some(Key::KeyZ),
        "1" => Some(Key::Num1), "2" => Some(Key::Num2), "3" => Some(Key::Num3),
        "4" => Some(Key::Num4), "5" => Some(Key::Num5), "6" => Some(Key::Num6),
        "7" => Some(Key::Num7), "8" => Some(Key::Num8), "9" => Some(Key::Num9),
        "0" => Some(Key::Num0),
        _ => None,
    }
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

        #[cfg(target_os = "macos")]
        let (final_x, final_y) = {
            let scale = info.scale_factor as f64;
            (target_x / scale, target_y / scale)
        };
        
        #[cfg(not(target_os = "macos"))]
        let (final_x, final_y) = (target_x, target_y);

        let _ = simulate(&EventType::MouseMove { x: final_x, y: final_y });
    }
}

#[command]
fn remote_mouse_click(button: String) {
    let btn = match button.as_str() {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    };
    
    // 1. 누른다
    let _ = simulate(&EventType::ButtonPress(btn));
    
    // 2. 0.05초 대기 (OS가 인식할 시간을 줌)
    thread::sleep(Duration::from_millis(50));
    
    // 3. 뗀다
    let _ = simulate(&EventType::ButtonRelease(btn));
}

#[command]
fn remote_keyboard_event(state: String, key: String) {
    if let Some(rdev_key) = str_to_key(&key) {
        let event = match state.as_str() {
            "down" => EventType::KeyPress(rdev_key),
            "up" => EventType::KeyRelease(rdev_key),
            _ => return,
        };
        let _ = simulate(&event);
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
fn get_clipboard_text() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

#[command]
fn set_clipboard_text(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())
}

#[command]
fn check_permissions() -> bool {
    #[cfg(target_os = "macos")]
    {
        return macos_accessibility_client::accessibility::application_is_trusted();
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
        let url = match permission_type.as_str() {
            "screen" => "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
            _ => "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        };
        
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .ok();
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = permission_type;
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|_app| { Ok(()) })
        .invoke_handler(tauri::generate_handler![
            remote_mouse_move, 
            remote_mouse_click,
            remote_keyboard_event,
            start_screen_capture,
            update_capture_settings,
            get_clipboard_text,
            set_clipboard_text,
            check_permissions,
            open_permission_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}