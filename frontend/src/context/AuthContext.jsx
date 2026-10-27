import {createContext,useContext,useEffect,useState} from 'react';
import api from '../services/api';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('qph_user'))}catch{return null}});
 const [loading,setLoading]=useState(Boolean(localStorage.getItem('qph_token')));
 useEffect(()=>{if(!localStorage.getItem('qph_token')){setLoading(false);return}api.get('/users/me').then(r=>{setUser(r.data.user);localStorage.setItem('qph_user',JSON.stringify(r.data.user))}).catch(()=>{localStorage.removeItem('qph_token');localStorage.removeItem('qph_user');setUser(null)}).finally(()=>setLoading(false))},[]);
 const login=async(email,password)=>{const {data}=await api.post('/auth/login',{email,password});localStorage.setItem('qph_token',data.token);localStorage.setItem('qph_user',JSON.stringify(data.user));setUser(data.user);return data.user};
 const register=async(payload)=>{await api.post('/auth/register',payload);return login(payload.email,payload.password)};
 const logout=()=>{localStorage.removeItem('qph_token');localStorage.removeItem('qph_user');setUser(null)};
 return <AuthContext.Provider value={{user,loading,login,register,logout}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
