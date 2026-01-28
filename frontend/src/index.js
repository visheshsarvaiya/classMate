import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { ChakraProvider } from "@chakra-ui/react";
import ChatProvider from "./Context/ChatProvider";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";

// -------------------- Axios Global Config --------------------
axios.defaults.baseURL = "https://classmate-3.onrender.com";
axios.defaults.withCredentials = true;

// -------------------- Render App --------------------
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <ChakraProvider>
      <BrowserRouter>
        <ChatProvider>
          <App />
        </ChatProvider>
      </BrowserRouter>
    </ChakraProvider>
  </React.StrictMode>
);

// -------------------- Performance --------------------
reportWebVitals();
