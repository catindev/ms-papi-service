API spec

POST /sessions
Авторизация

GET /customers
Лиды

POST /customers/cold.leads
Сохранить холодных лидов ([lead]: { name, phone, description })

GET /cusomers/funnel
Воронка — клиенты в работе

GET /customers/recent
10 последних недавно редактированных клиентов

GET /customers/:id
карточка клиента ака профиль. если лид, то нарисовать вопрос

PUT /customers/:id
Редактировать клиента

PUT /customers/:id/pipe.down
Передвинуть клиента на следующий шаг по воронке

PUT /customers/:id/deal
Закрыть сделку (amount, comment)

PUT /customers/:id/reject
Закрыть сделку (reason, comment)

GET /customers/:id/calls
Записи разговоров

POST /customers/:id/call
Коллбек. Звонить с транка пользователя. Проверить транк на active. Если отключен,
то звонить с SEO или первого транка в списке активных
