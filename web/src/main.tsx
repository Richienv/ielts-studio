import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ChatGPTProvider } from './ChatGPTConnection';
import './styles.css';
class Boundary extends React.Component<{children:React.ReactNode},{error:string}> {
  state={error:''};static getDerivedStateFromError(error:Error){return {error:error.message};}
  render(){return this.state.error?<main className="fatal"><h1>The workspace could not load.</h1><p>Your saved answers remain on this browser. Reload to recover your session.</p><p>{this.state.error}</p><button onClick={()=>location.reload()}>Reload workspace</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<Boundary><ChatGPTProvider><App/></ChatGPTProvider></Boundary>);
