const users = [
{ "name" : "Телеканал Алматы", "phone" : "+77273250500" },
{ "name" : "Instagram (старый)", "phone" : "+77273250600" },
{ "name" : "Яндекс (старый)", "phone" : "+77273250700" },
{ "name" : "Google (старый)", "phone" : "+77273250377" },
{ "name" : "Google", "phone" : "+77470941260" },
{ "name" : "Instagram", "phone" : "+77470941262" },
{ "name" : "Facebook", "phone" : "+77470941263" },
{ "name" : "SEO", "phone" : "+77470941264" },
{ "name" : "Яндекс", "phone" : "+77470941261" },
{ "name" : "Крыша.kz", "phone" : "+77470941265" },
{ "name" : "Рассылка ЖССБ", "phone" : "+77470941266" },
{ "name" : "Баннер в городке", "phone" : "+77470941267" }
]

users.forEach(user => {
  console.log(user.name,user.phone)
})