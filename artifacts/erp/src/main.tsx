import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { getAuthToken } from "@/lib/auth-token";

setAuthTokenGetter(getAuthToken);

createRoot(document.getElementById("root")!).render(<App />);
