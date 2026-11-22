import { useLocation, useNavigate } from "react-router";

// Cancel goes back to the page the user came from, or to Lists when this page
// was the first the browser opened ("default" is the history's first key).
export function useCancel(): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => {
    if (key === "default") void navigate("/");
    else void navigate(-1);
  };
}
