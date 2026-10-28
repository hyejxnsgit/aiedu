import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// base './': 빌드 결과(dist)를 어느 경로에서 열어도 동작하게 한다. 학교에서 Node 없이 preview.py로 dist만 제공할 수 있다.
export default defineConfig({base:'./',plugins:[react()],server:{host:'127.0.0.1',port:8766,fs:{allow:['..']}},preview:{host:'127.0.0.1',port:8766}});
