(function () {
  "use strict";

  var grid = document.querySelector("[data-media-grid]");
  var source = document.querySelector("[data-media-source]");
  var sentinel = document.querySelector("[data-media-sentinel]");
  var status = document.querySelector("[data-media-status]");

  if (!grid || !source || !sentinel || !status) return;

  var cards = Array.prototype.slice.call(source.content.children);
  var total = cards.length;
  var loaded = 0;
  var batchSize = window.matchMedia("(max-width: 480px)").matches ? 12 : 24;
  var loading = false;

  function prepareImage(card) {
    var image = card.querySelector("img[data-src]");
    if (!image) return;

    image.addEventListener("error", function () {
      image.hidden = true;
      if (image.nextElementSibling) image.nextElementSibling.hidden = false;
    }, { once: true });

    image.src = image.dataset.src;
    image.removeAttribute("data-src");
  }

  function updateStatus() {
    if (loaded >= total) {
      status.textContent = "已显示全部 " + total + " 条记录";
      sentinel.hidden = true;
      return;
    }
    status.textContent = "已显示 " + loaded + " / " + total + "，继续向下滚动";
  }

  function appendBatch() {
    if (loading || loaded >= total) return;
    loading = true;

    var fragment = document.createDocumentFragment();
    var end = Math.min(loaded + batchSize, total);
    for (var index = loaded; index < end; index += 1) {
      var card = cards[index];
      prepareImage(card);
      fragment.appendChild(card);
    }
    grid.appendChild(fragment);
    loaded = end;
    loading = false;
    updateStatus();
  }

  appendBatch();

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        appendBatch();
        if (loaded >= total) observer.disconnect();
      }
    }, { rootMargin: "700px 0px" });
    observer.observe(sentinel);
  } else {
    window.addEventListener("scroll", function () {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 900) {
        appendBatch();
      }
    }, { passive: true });
  }
}());
