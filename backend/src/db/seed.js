require('dotenv').config();
const bcrypt=require('bcryptjs');
const path=require('path');
const fs=require('fs');
const db=require('./database');
const uploadDir=path.resolve(__dirname,'../../',process.env.UPLOAD_DIR||'uploads');
fs.mkdirSync(uploadDir,{recursive:true});
// Minimal valid one-page PDF used as demo content, not an actual institutional exam paper.
const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 91>>stream\nBT /F1 18 Tf 72 720 Td (QPaper Hub Demo Question Paper) Tj 0 -30 Td /F1 11 Tf (Sample PDF for local development only.) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const adminEmail='admin@qpaperhub.local';
const users=[
 {name:'QPaper Hub Admin',email:adminEmail,password:'Admin@12345',role:'admin',department:'Computer Science',semester:1},
 {name:'Demo Student One',email:'student1@qpaperhub.local',password:'Student@123',role:'student',department:'Computer Science',semester:5},
 {name:'Demo Student Two',email:'student2@qpaperhub.local',password:'Student@123',role:'student',department:'Electronics',semester:3}
];
const get=db.prepare('SELECT id FROM users WHERE email=?');
const addUser=db.prepare('INSERT INTO users(name,email,password_hash,role,department,semester) VALUES(?,?,?,?,?,?)');
for(const u of users) if(!get.get(u.email)) addUser.run(u.name,u.email,bcrypt.hashSync(u.password,10),u.role,u.department,u.semester);
const admin=get.get(adminEmail).id;
const samples=[
 ['Data Structures and Algorithms','Data Structures','CS301','Computer Science',3,2024,'Mid-1'],
 ['Database Management Systems','DBMS','CS402','Computer Science',4,2023,'Semester'],
 ['Operating Systems','Operating Systems','CS403','Computer Science',4,2024,'Mid-2'],
 ['Computer Networks','Computer Networks','CS501','Computer Science',5,2025,'Semester'],
 ['Java Programming','Java Programming','CS302','Computer Science',3,2022,'Supplementary'],
 ['Digital Logic Design','Digital Logic','EC201','Electronics',2,2024,'Mid-1'],
 ['Signals and Systems','Signals and Systems','EC301','Electronics',3,2023,'Semester'],
 ['Microprocessors','Microprocessors','EC402','Electronics',4,2025,'Mid-2'],
 ['Engineering Mathematics II','Engineering Mathematics II','ME202','Mechanical',2,2024,'Semester'],
 ['Thermodynamics','Thermodynamics','ME301','Mechanical',3,2022,'Supplementary'],
 ['Web Technologies','Web Technologies','CS601','Computer Science',6,2025,'Mid-1'],
 ['Electronic Circuits','Electronic Circuits','EC202','Electronics',2,2023,'Mid-2']
];
const addPaper=db.prepare('INSERT INTO papers(title,subject,subject_code,department,semester,year,exam_type,file_path,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?)');
const count=db.prepare('SELECT COUNT(*) n FROM papers').get().n;
if(count===0) for(let i=0;i<samples.length;i++){
 const filename=`demo-paper-${i+1}.pdf`; fs.writeFileSync(path.join(uploadDir,filename),pdf);
 addPaper.run(...samples[i],path.relative(path.resolve(__dirname,'../..'),path.join(uploadDir,filename)),admin);
}
console.log('Seed complete. Admin: admin@qpaperhub.local / Admin@12345; students: student1@qpaperhub.local / Student@123 and student2@qpaperhub.local / Student@123');
db.close();
