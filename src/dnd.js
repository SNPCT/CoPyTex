// 셀 순서 바꾸기(드래그 앤 드롭). 상단바(헤더)를 잡고 끌어요.
// - makeDraggable: 헤더에서 끌기 시작 (버튼/입력칸에서는 시작하지 않아요)
// - setupDropZone: 목록 위에서 놓을 자리를 파란 줄로 보여주고, 놓으면 onMove(id, index) 를 불러요.
let dragId = null;

export function makeDraggable(headerEl, cellEl, id) {
  headerEl.addEventListener('pointerdown', (e) => {
    headerEl.draggable = !e.target.closest('button, input, textarea, select, a');
  });
  headerEl.addEventListener('dragstart', (e) => {
    dragId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-copytex-cell', id); // 일반 글자(text/plain)는 넣지 않아요 → 에디터에 붙지 않음
    try { e.dataTransfer.setDragImage(cellEl, 24, 18); } catch (err) { /* ignore */ }
    requestAnimationFrame(() => cellEl.classList.add('dragging'));
    document.body.classList.add('is-dragging');
  });
  headerEl.addEventListener('dragend', () => {
    dragId = null;
    headerEl.draggable = false;
    cellEl.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    hideLine();
  });
}

let line = null;
function showLine(rect) {
  if (!line) { line = document.createElement('div'); line.className = 'drop-line'; document.body.appendChild(line); }
  line.style.display = 'block';
  line.style.left = rect.left + 'px';
  line.style.width = rect.width + 'px';
  line.style.top = rect.y - 2 + 'px';
}
function hideLine() { if (line) line.style.display = 'none'; }

export function setupDropZone(listEl, onMove) {
  const cellEls = () => Array.from(listEl.querySelectorAll('.cell'));

  // 포인터 위치 → 들어갈 자리(0..n)와 파란 줄의 위치
  function locate(clientY) {
    const els = cellEls();
    if (!els.length) return null;
    let index = els.length;
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { index = i; break; }
    }
    const ref = index < els.length ? els[index].getBoundingClientRect() : els[els.length - 1].getBoundingClientRect();
    const y = index < els.length ? ref.top - 6 : ref.bottom + 6;
    return { index, rect: { left: ref.left, width: ref.width, y } };
  }

  function autoScroll(clientY) {
    const edge = 80;
    if (clientY < edge) window.scrollBy(0, -Math.ceil((edge - clientY) / 4));
    else if (clientY > window.innerHeight - edge) window.scrollBy(0, Math.ceil((clientY - (window.innerHeight - edge)) / 4));
  }

  listEl.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const loc = locate(e.clientY);
    if (loc) showLine(loc.rect);
    autoScroll(e.clientY);
  }, true);

  listEl.addEventListener('drop', (e) => {
    if (!dragId) return;
    e.preventDefault(); e.stopPropagation();
    const loc = locate(e.clientY);
    const id = dragId;
    dragId = null;
    hideLine();
    document.body.classList.remove('is-dragging');
    if (loc) onMove(id, loc.index);
  }, true);

  listEl.addEventListener('dragleave', (e) => { if (!e.relatedTarget || !listEl.contains(e.relatedTarget)) hideLine(); });
}
