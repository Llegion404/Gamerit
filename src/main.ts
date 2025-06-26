import { createApp } from "vue";
import Toast from "vue-toastification";
import router from "./router";
// Import the CSS or use your own!
import "vue-toastification/dist/index.css";
import App from "./App.vue";
import "./index.css";

const app = createApp(App);

// Use the router
app.use(router);

// Use the toast plugin with default options
app.use(Toast, {
  position: "top-right",
  timeout: 5000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: "button",
  icon: true,
  rtl: false,
});

app.mount("#root");
