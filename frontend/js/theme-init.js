(function applyInitialTheme() {
  try {
    const stored = localStorage.getItem("bt_theme");
    const preferred =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.setAttribute("data-theme", preferred);
    document.documentElement.style.colorScheme = preferred;
  } catch (error) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
