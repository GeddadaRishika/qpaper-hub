import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom';
import Layout from './components/Layout';
import {AuthProvider,useAuth} from './context/AuthContext';
import {Landing,Login,Register,Browse,PaperDetails,Saved,Profile,AdminDashboard,PaperForm} from './pages/Pages';
import './styles.css';
function Guard({children,admin=false}){const {user,loading}=useAuth();if(loading)return <div className="loading full-loading"><span className="spinner"/> Loading your account…</div>;if(!user)return <Navigate to="/login" replace/>;if(admin&&user.role!=='admin')return <Navigate to="/papers" replace/>;return children}
function AppRoutes(){return <Layout><Routes><Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/papers" element={<Browse/>}/><Route path="/papers/:id" element={<PaperDetails/>}/><Route path="/saved" element={<Guard><Saved/></Guard>}/><Route path="/profile" element={<Guard><Profile/></Guard>}/><Route path="/admin" element={<Guard admin><AdminDashboard/></Guard>}/><Route path="/admin/upload" element={<Guard admin><PaperForm/></Guard>}/><Route path="/admin/papers/:id/edit" element={<Guard admin><PaperForm/></Guard>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Layout>}
export default function App(){return <BrowserRouter><AuthProvider><AppRoutes/></AuthProvider></BrowserRouter>}
