// Zoom sur l'image centrale (page-image)
let mainImage = document.querySelector(".center img");

mainImage.addEventListener("click", () => {
  mainImage.width = mainImage.width + 10;
});

mainImage.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  mainImage.width = mainImage.width - 10;
});

// Validation du formulaire de commentaire
let submitButton = document.querySelector('input[type="submit"]');
let commentaire = document.querySelector('input[name="commentaire"]');

submitButton.disabled = true;

commentaire.addEventListener("keyup", () => {
  if (commentaire.value === "") {
    submitButton.disabled = true;
  } else {
    submitButton.disabled = false;
  }
});
