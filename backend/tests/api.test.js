process.env.NODE_ENV='test';
process.env.JWT_SECRET='test-only-secret';
process.env.JWT_EXPIRES_IN='1d';
process.env.UPLOAD_DIR='uploads';
const request=require('supertest');
const fs=require('fs');
const path=require('path');
const Database=require('better-sqlite3');
const dbPath=path.join(__dirname,'../data/qpaper-hub.sqlite');
let app, db, studentToken, adminToken, paperId;
beforeAll(()=>{
 fs.mkdirSync(path.dirname(dbPath),{recursive:true});
 try{fs.unlinkSync(dbPath)}catch{}
 // Load app once, then seed using its database module.
 app=require('../src/server');
 db=require('../src/db/database');
 const bcrypt=require('bcryptjs');
 const a=db.prepare('INSERT INTO users(name,email,password_hash,role,department,semester) VALUES(?,?,?,?,?,?)').run('Test Admin','admin@test.local',bcrypt.hashSync('Password123',4),'admin','Computer Science',1);
 db.prepare('INSERT INTO users(name,email,password_hash,role,department,semester) VALUES(?,?,?,?,?,?)').run('Test Student','student@test.local',bcrypt.hashSync('Password123',4),'student','Computer Science',3);
 const f=path.join(__dirname,'../uploads/test.pdf'); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,'%PDF-1.4 demo');
 paperId=db.prepare('INSERT INTO papers(title,subject,subject_code,department,semester,year,exam_type,file_path,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?)').run('Test DBMS','DBMS','CS301','Computer Science',3,2024,'Mid-1','backend/uploads/test.pdf',a.lastInsertRowid).lastInsertRowid;
});
afterAll(()=>{ if(db)db.close(); try{fs.unlinkSync(dbPath)}catch{} });
test('register and login',async()=>{
 const email=`new-${Date.now()}@test.local`;
 const r=await request(app).post('/api/auth/register').send({name:'New Student',email,password:'Password123',department:'Computer Science',semester:2});
 expect(r.status).toBe(201);
 const l=await request(app).post('/api/auth/login').send({email,password:'Password123'});
 expect(l.status).toBe(200); expect(l.body.token).toBeTruthy(); studentToken=l.body.token;
});
test('protected route rejects missing token',async()=>{expect((await request(app).get('/api/users/me')).status).toBe(401)});
test('paper listing supports filters',async()=>{
 const r=await request(app).get('/api/papers?department=Computer%20Science&semester=3');
 expect(r.status).toBe(200); expect(r.body.papers.some(p=>p.id===paperId)).toBe(true);
});
test('admin route blocks student',async()=>{
 const l=await request(app).post('/api/auth/login').send({email:'student@test.local',password:'Password123'});
 studentToken=l.body.token;
 expect((await request(app).get('/api/admin/users').set('Authorization',`Bearer ${studentToken}`)).status).toBe(403);
 const a=await request(app).post('/api/auth/login').send({email:'admin@test.local',password:'Password123'});
 adminToken=a.body.token;
});
test('save and unsave paper',async()=>{
 const saved=await request(app).post(`/api/papers/${paperId}/save`).set('Authorization',`Bearer ${studentToken}`);
 expect(saved.status).toBe(201);
 const list=await request(app).get('/api/saved').set('Authorization',`Bearer ${studentToken}`);
 expect(list.status).toBe(200); expect(list.body.papers.some(p=>p.id===paperId)).toBe(true);
 const removed=await request(app).delete(`/api/papers/${paperId}/save`).set('Authorization',`Bearer ${studentToken}`);
 expect(removed.status).toBe(200);
});
