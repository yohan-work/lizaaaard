const button = document.getElementById('disable-click-through');

button.addEventListener('click', () => {
  window.petAPI.disableClickThrough();
});
