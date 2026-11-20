const form = document.querySelector('#post-form');
const nameInput = document.querySelector('#name');
const bodyInput = document.querySelector('#body');
const bodyCount = document.querySelector('#body-count');
const submit = document.querySelector('#submit');
const formStatus = document.querySelector('#form-status');
const reload = document.querySelector('#reload');
const list = document.querySelector('#posts');
const listStatus = document.querySelector('#list-status');
const template = document.querySelector('#post-template');

const dateFormat = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function renderPost(post) {
  const item = template.content.firstElementChild.cloneNode(true);
  item.querySelector('.post-id').textContent = `#${post.id}`;
  item.querySelector('.post-name').textContent = post.name;
  const time = item.querySelector('.post-time');
  time.dateTime = post.created_at;
  time.textContent = dateFormat.format(new Date(post.created_at));
  // textContent で表示し、本文中のHTMLを解釈させない。
  item.querySelector('.post-body').textContent = post.body;
  return item;
}

async function loadPosts() {
  reload.disabled = true;
  listStatus.textContent = '読み込み中…';
  listStatus.hidden = false;
  try {
    const response = await fetch('/api/posts', { cache: 'no-store' });
    if (!response.ok) throw new Error('投稿を読み込めませんでした。「更新」を押してください。');
    const { posts } = await response.json();
    list.replaceChildren(...posts.map(renderPost));
    if (posts.length === 0) {
      listStatus.textContent = 'まだ投稿はありません。最初の書き込みをどうぞ！';
    } else {
      listStatus.hidden = true;
    }
  } catch (error) {
    listStatus.textContent = error.message;
  } finally {
    reload.disabled = false;
  }
}

function setFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle('error', isError);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = bodyInput.value.trim();
  if (!body) {
    setFormStatus('本文を入力してください。', true);
    bodyInput.focus();
    return;
  }
  submit.disabled = true;
  setFormStatus('投稿中…');
  try {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.value, body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? '投稿できませんでした。もう一度お試しください。');
    bodyInput.value = '';
    bodyCount.textContent = '0';
    setFormStatus('投稿しました！');
    await loadPosts();
  } catch (error) {
    setFormStatus(error.message, true);
  } finally {
    submit.disabled = false;
  }
});

bodyInput.addEventListener('input', () => {
  bodyCount.textContent = String(bodyInput.value.length);
});
reload.addEventListener('click', loadPosts);
loadPosts();
