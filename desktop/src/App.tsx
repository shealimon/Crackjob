import { StealthLocalCursor } from "./components/StealthLocalCursor";
import { MainApp } from "./windows/MainApp";
import { OverlayApp } from "./windows/OverlayApp";

export default function App({ overlay }: { overlay: boolean }) {
  return (
    <>
      {overlay ? <OverlayApp /> : <MainApp />}
      <StealthLocalCursor />
    </>
  );
}
