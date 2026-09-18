function highlight(element) {
  element.classList.add('selected')
}

document.addEventListener('click', function (event) {
  highlight(event.target)
})
