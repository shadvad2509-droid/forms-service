const express = require('express');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/admin'));

// Админка — список форм
app.get('/admin', (req, res) => {
  db.all('SELECT * FROM forms ORDER BY created_at DESC', (err, forms) => {
    if (err) return res.status(500).send('Ошибка БД');
    res.render('admin', { forms });
  });
});

// Создание формы
app.post('/admin/create', (req, res) => {
  const { title, fields } = req.body;
  const token = crypto.randomBytes(6).toString('hex');
  const fieldList = fields.split(',').map(f => f.trim()).filter(Boolean);

  db.run(
    'INSERT INTO forms (title, fields, token) VALUES (?, ?, ?)',
    [title, JSON.stringify(fieldList), token],
    (err) => {
      if (err) return res.status(500).send('Ошибка');
      res.redirect('/admin');
    }
  );
});

// Публичная форма
app.get('/f/:token', (req, res) => {
  db.get('SELECT * FROM forms WHERE token = ?', [req.params.token], (err, form) => {
    if (err || !form) return res.status(404).send('Форма не найдена');
    form.fields = JSON.parse(form.fields);
    res.render('form', { form });
  });
});

// Отправка ответа
app.post('/f/:token', (req, res) => {
  db.get('SELECT * FROM forms WHERE token = ?', [req.params.token], (err, form) => {
    if (err || !form) return res.status(404).send('Форма не найдена');

    const data = {};
    const fields = JSON.parse(form.fields);
    fields.forEach(f => { data[f] = req.body[f] || ''; });

    db.run(
      'INSERT INTO responses (form_id, data) VALUES (?, ?)',
      [form.id, JSON.stringify(data)],
      (err) => {
        if (err) return res.status(500).send('Ошибка');
        res.send('<h1>Спасибо!</h1><p>Ваш ответ отправлен.</p><a href="/">На главную</a>');
      }
    );
  });
});

// Просмотр ответов
app.get('/admin/responses/:id', (req, res) => {
  db.get('SELECT * FROM forms WHERE id = ?', [req.params.id], (err, form) => {
    if (err || !form) return res.status(404).send('Форма не найдена');

    db.all('SELECT * FROM responses WHERE form_id = ? ORDER BY created_at DESC',
      [form.id], (err, responses) => {
        if (err) return res.status(500).send('Ошибка');
        form.fields = JSON.parse(form.fields);
        responses.forEach(r => r.data = JSON.parse(r.data));
        res.render('responses', { form, responses });
      });
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});