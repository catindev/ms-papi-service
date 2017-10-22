API spec

customers.canModify 
Проверка на допуск к изменениям - аккаунты клиента и юзера одинаковые

POST /sessions
Авторизация

GET /sessions?session_token=
Авторизация

GET /customers?funnel=lead|cold&search=query
Лиды. Холодные или горячие. Если funnel не задано, то рисуем всю воронку
Если есть search=query, то это поиск по номеру или имени (посмотреть как в старом сделано)

GET /customers/deals
Закрытые сделки

GET /customers/history
Список клиентов отсортированный по lastEdit

PUT /customers/:id/pipe.down
Передвинуть клиента на следующий шаг по воронке

PUT /customers/:id/deal
Закрыть сделку (amount, comment)

PUT /customers/:id
Редактировать клиента

PUT /customers/:id/reject
Закрыть сделку (reason, comment)

GET /customers/:id
карточка клиента ака профиль. если лид, то нарисовать вопрос

GET /customers/:id/options
Действия с клиентом

GET /customers/:id/calls
Записи разговоров

POST /customers/:id/call
Коллбек. Звонить с транка пользователя. Проверить транк на active. Если отключен,
то звонить с SEO или первого транка в списке активных
