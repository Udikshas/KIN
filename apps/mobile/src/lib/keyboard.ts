import { useEffect, useState } from "react";
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from "react-native";

/**
 * True while the on-screen keyboard is up, so a screen can tighten its layout
 * (the keyboard covers the home bar, so its safe-area padding is not needed).
 */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    // Animate the layout change with the keyboard's own duration and curve, both ways.
    const toggle = (next: boolean) => (e: KeyboardEvent) => {
      LayoutAnimation.configureNext({
        duration: e.duration || 250,
        update: { type: ios ? LayoutAnimation.Types.keyboard : LayoutAnimation.Types.easeInEaseOut },
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
      setOpen(next);
    };
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", toggle(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", toggle(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}
