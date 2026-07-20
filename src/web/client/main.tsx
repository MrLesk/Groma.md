import { createRoot } from "react-dom/client";

import { MARK_FRONTAL } from "./brand.ts";
import { App } from "./app.tsx";

const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/svg+xml";
favicon.href = `data:image/svg+xml,${encodeURIComponent(MARK_FRONTAL)}`;
document.head.appendChild(favicon);

const root = document.getElementById("root");
if (root === null) throw new Error("The web shell is missing its root element");
createRoot(root).render(<App />);
