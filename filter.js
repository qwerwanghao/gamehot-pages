const filters = document.querySelector("[data-filters]");
if (filters) {
  const query = filters.querySelector("[data-query]");
  const category = filters.querySelector("[data-category]");
  const items = [...document.querySelectorAll("[data-item]")];
  const empty = document.querySelector("[data-empty]");
  const update = () => {
    const words = query.value.trim().toLocaleLowerCase().split(/\s+/);
    let visible = 0;
    for (const item of items) {
      const text = item.textContent.toLocaleLowerCase();
      item.hidden = (category.value !== "" && item.dataset.item !== category.value) ||
        !words.every((word) => text.includes(word));
      if (!item.hidden) visible += 1;
    }
    empty.hidden = visible > 0;
  };
  filters.addEventListener("input", update);
  filters.addEventListener("change", update);
  filters.hidden = false;
}
