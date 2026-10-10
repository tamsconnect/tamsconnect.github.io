import React from "react";
import { createRoot } from "react-dom/client";
import DemoEntry from "./components/demo-entry";
import "./app/globals.css";
import "./app/community.css";
import "./app/demo-entry.css";
createRoot(document.getElementById("root")!).render(<DemoEntry/>);
