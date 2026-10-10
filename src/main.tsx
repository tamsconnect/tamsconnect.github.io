import React from "react";
import { createRoot } from "react-dom/client";
import CommunityApp from "./components/commons";
import "./app/globals.css";
import "./app/community.css";
createRoot(document.getElementById("root")!).render(<CommunityApp/>);
