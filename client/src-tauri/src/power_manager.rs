use std::sync::atomic::{AtomicBool, Ordering};

static IS_SLEEP_PREVENTED: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
mod windows_power {
    extern "system" {
        fn SetThreadExecutionState(es_flags: u32) -> u32;
    }

    const ES_CONTINUOUS: u32 = 0x8000_0000;
    const ES_SYSTEM_REQUIRED: u32 = 0x0000_0001;
    const ES_DISPLAY_REQUIRED: u32 = 0x0000_0002;
    const ES_AWAYMODE_REQUIRED: u32 = 0x0000_0040;

    pub fn set_sleep_prevention(enable: bool) {
        unsafe {
            if enable {
                // System required + Away mode: Screen can turn off to save power, but CPU/Network never sleeps
                SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED);
                println!("🔋 [PowerManager] Windows System Sleep Prevention: ON");
            } else {
                SetThreadExecutionState(ES_CONTINUOUS);
                println!("🔋 [PowerManager] Windows System Sleep Prevention: OFF");
            }
        }
    }

    pub fn wake_display() {
        unsafe {
            // Force display to turn on and reset idle timers
            SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED);
            println!("💡 [PowerManager] Windows Display Wake Signal Sent");
        }
    }
}

#[cfg(target_os = "macos")]
mod macos_power {
    use std::process::Command;
    use std::sync::Mutex;
    use std::process::Child;

    static CAFFEINATE_CHILD: Mutex<Option<Child>> = Mutex::new(None);

    pub fn set_sleep_prevention(enable: bool) {
        let mut lock = CAFFEINATE_CHILD.lock().unwrap();
        if enable {
            if lock.is_none() {
                // caffeinate -s: Prevents system from sleeping
                if let Ok(child) = Command::new("caffeinate").arg("-s").spawn() {
                    *lock = Some(child);
                    println!("🔋 [PowerManager] macOS caffeinate sleep prevention: ON");
                }
            }
        } else {
            if let Some(mut child) = lock.take() {
                let _ = child.kill();
                println!("🔋 [PowerManager] macOS caffeinate sleep prevention: OFF");
            }
        }
    }

    pub fn wake_display() {
        // caffeinate -u -t 5: Asserts user active for 5 seconds to wake up screen
        let _ = Command::new("caffeinate")
            .args(&["-u", "-t", "5"])
            .spawn();
        println!("💡 [PowerManager] macOS Display Wake Signal Sent");
    }
}

pub fn prevent_sleep(enable: bool) {
    IS_SLEEP_PREVENTED.store(enable, Ordering::SeqCst);
    #[cfg(target_os = "windows")]
    windows_power::set_sleep_prevention(enable);

    #[cfg(target_os = "macos")]
    macos_power::set_sleep_prevention(enable);
}

pub fn wake_display() {
    #[cfg(target_os = "windows")]
    {
        windows_power::wake_display();
        if let Some((x, y)) = crate::kvm_manager::get_os_cursor_pos() {
            let _ = rdev::simulate(&rdev::EventType::MouseMove { x: x + 1.0, y });
            std::thread::sleep(std::time::Duration::from_millis(15));
            let _ = rdev::simulate(&rdev::EventType::MouseMove { x, y });
        }
    }

    #[cfg(target_os = "macos")]
    {
        macos_power::wake_display();
        if let Some((x, y)) = crate::kvm_manager::get_os_cursor_pos() {
            let _ = rdev::simulate(&rdev::EventType::MouseMove { x: x + 1.0, y });
            std::thread::sleep(std::time::Duration::from_millis(15));
            let _ = rdev::simulate(&rdev::EventType::MouseMove { x, y });
        }
    }
}
