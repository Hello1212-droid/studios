#include <napi.h>
#include <windows.h>

HHOOK hhkLowLevelKybd;

LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION) {
        KBDLLHOOKSTRUCT *pKbdStruct = (KBDLLHOOKSTRUCT *)lParam;
        // Check if Windows key is pressed (VK_LWIN or VK_RWIN)
        if (pKbdStruct->vkCode == VK_LWIN || pKbdStruct->vkCode == VK_RWIN) {
            return 1; // Block the key
        }
    }
    return CallNextHookEx(hhkLowLevelKybd, nCode, wParam, lParam);
}

Napi::Value StartHook(const Napi::CallbackInfo& info) {
    hhkLowLevelKybd = SetWindowsHookEx(WH_KEYBOARD_LL, LowLevelKeyboardProc, GetModuleHandle(NULL), 0);
    return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("startHook", Napi::Function::New(env, StartHook));
    return exports;
}

NODE_API_MODULE(kiosk_hook, Init)
