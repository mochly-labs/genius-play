let debounceTimeouts = {
  1: null,
  2: null,
};

function ButtonPressCalibrator(btnId) {
  const btn = document.getElementById(btnId === 2 ? "btn-left" : "btn-right");

  btn.classList.add("opacity-100");
  btn.classList.remove("opacity-20");

  clearTimeout(debounceTimeouts[btnId]);

  debounceTimeouts[btnId] = setTimeout(() => {
    btn.classList.remove("opacity-100");
    btn.classList.add("opacity-20");
  }, 1000);
}
