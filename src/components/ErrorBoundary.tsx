import React from 'react';
import {View,Text,Pressable} from 'react-native';
export class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:boolean}>{
 state={error:false};
 static getDerivedStateFromError(){return {error:true};}
 render(){if(this.state.error)return <View style={{flex:1,backgroundColor:'#0A0D12',padding:35,justifyContent:'center',alignItems:'center',gap:20}}><Text style={{fontSize:24,color:'#F0F3F8'}}>Let’s get your view back.</Text><Text style={{color:'#8C97A8',textAlign:'center'}}>IPward encountered a display error. Your saved local data has not been removed.</Text><Pressable accessibilityRole="button" onPress={()=>this.setState({error:false})} style={{padding:16,backgroundColor:'#94B5FF',borderRadius:10}}><Text>Try again</Text></Pressable></View>;return this.props.children;}
}
