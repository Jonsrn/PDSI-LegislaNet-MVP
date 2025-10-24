@echo off
echo ====================================
echo   LEGISLA NET - TABLET BACKEND
echo ====================================
echo.
echo Verificando dependencias...
if not exist node_modules (
    echo Instalando dependencias...
    npm install
)

echo.
echo Criando diretorio de logs...
if not exist logs mkdir logs

echo.
echo Verificando arquivo .env...
if not exist .env (
    echo ERRO: Arquivo .env nao encontrado!
    echo Copie .env.example para .env e configure as variaveis.
    pause
    exit /b 1
)

echo.
echo Iniciando servidor em modo desenvolvimento...
echo Backend estara disponivel em: http://localhost:3001
echo.
npm run dev