const express = require("express")
const cors = require("cors")

const { MercadoPagoConfig, Payment } = require("mercadopago")

const app = express()

app.use(cors())
app.use(express.json())

// CONFIGURAR MERCADO PAGO
const client = new MercadoPagoConfig({
accessToken: "SEU_ACCESS_TOKEN_AQUI"
})

const payment = new Payment(client)

// LISTA DE CARROS
const cars = [
{id:1,name:"Kart",price:0.10,weight:1,emoji:"🛴"},
{id:2,name:"Fiat Uno",price:0.20,weight:2,emoji:"🚗"},
{id:3,name:"Civic",price:0.35,weight:3,emoji:"🚙"},
{id:4,name:"Nissan GTR",price:0.50,weight:4,emoji:"🏎"},
{id:5,name:"Porsche 911",price:0.70,weight:5,emoji:"🏎"},
{id:6,name:"Ferrari F8",price:1.00,weight:6,emoji:"🏎"}
]

// HISTÓRICO
let raceHistory = []

// PAGAMENTOS
let payments = {}

// CORRIDA ATUAL
let currentRace = {
id:1,
status:"waiting",
maxPlayers:5,
players:[],
result:null
}

// TESTE API
app.get("/api/test",(req,res)=>{
res.json({message:"API funcionando"})
})

// LISTAR CARROS
app.get("/api/cars",(req,res)=>{
res.json(cars)
})

// CORRIDA ATUAL
app.get("/api/race",(req,res)=>{
res.json(currentRace)
})

// RESULTADO
app.get("/api/result",(req,res)=>{
res.json(currentRace.result || [])
})

// HISTÓRICO
app.get("/api/history",(req,res)=>{
res.json(raceHistory)
})

// ENTRAR NA CORRIDA (AGORA EXIGE PAGAMENTO)
app.post("/api/join-race",(req,res)=>{

const {username,carId,payment_id} = req.body

if(!username || !carId || !payment_id){
return res.status(400).json({message:"dados incompletos"})
}

if(!payments[payment_id] || payments[payment_id].status !== "approved"){
return res.status(403).json({message:"pagamento não aprovado"})
}

if(currentRace.status !== "waiting"){
return res.json({message:"corrida não disponível"})
}

if(currentRace.players.length >= currentRace.maxPlayers){
return res.json({message:"corrida cheia"})
}

const alreadyJoined = currentRace.players.find(
p => p.username === username
)

if(alreadyJoined){
return res.json({message:"você já está na corrida"})
}

currentRace.players.push({
username,
carId
})

res.json({
message:"entrou na corrida",
race:currentRace
})

})

// INICIAR CORRIDA
app.post("/api/start-race",(req,res)=>{

if(currentRace.players.length < 2){
return res.json({message:"mínimo de 2 jogadores"})
}

if(currentRace.status !== "waiting"){
return res.json({message:"corrida já iniciada"})
}

currentRace.status="live"

res.json({
message:"corrida iniciada"
})

})

// FINALIZAR CORRIDA
app.post("/api/finish-race",(req,res)=>{

if(currentRace.status !== "live"){
return res.json({message:"corrida não está ativa"})
}

if(currentRace.result){
return res.json({
message:"resultado já existe",
result:currentRace.result
})
}

const {ranking} = req.body

if(!ranking || !Array.isArray(ranking)){
return res.json({message:"ranking inválido"})
}

const result = ranking.map((username,index)=>{

const player = currentRace.players.find(
p => p.username === username
)

if(!player) return null

return {
position:index+1,
username:player.username,
carId:player.carId
}

}).filter(Boolean)

currentRace.result=result
currentRace.status="finished"

// salvar histórico
raceHistory.push({
raceId:currentRace.id,
result:result,
date:new Date()
})

res.json({
message:"corrida finalizada",
result
})

})

// RESETAR CORRIDA
app.post("/api/reset-race",(req,res)=>{

currentRace={
id:currentRace.id+1,
status:"waiting",
maxPlayers:5,
players:[],
result:null
}

res.json({
message:"nova corrida criada",
race:currentRace
})

})

// CRIAR PAGAMENTO PIX
app.post("/api/create-payment", async (req,res)=>{

const {title, price, username, carId} = req.body

if(!title || !price){
return res.status(400).json({error:"dados inválidos"})
}

try{

const response = await payment.create({
body:{
transaction_amount:Number(price),
description:title,
payment_method_id:"pix",
payer:{
email:"comprador@email.com"
}
}
})

payments[response.id] = {
status:"pending",
username,
carId
}

res.json({
payment_id: response.id,
qr_code: response.point_of_interaction.transaction_data.qr_code,
qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
})

}catch(error){

console.log("ERRO PIX:",error)

res.status(500).json({error:"erro ao criar pagamento"})

}

})

// VERIFICAR PAGAMENTO
app.get("/api/payment-status/:id", async (req,res)=>{

const id = req.params.id

try{

const result = await payment.get({ id })

if(result.status === "approved"){
payments[id].status = "approved"
}

res.json({
status: payments[id]?.status || "pending"
})

}catch(error){

console.log("ERRO CONSULTA PIX:",error)

res.status(500).json({error:"erro ao verificar pagamento"})

}

})

// SERVIDOR
app.listen(3000,()=>{
console.log("Servidor rodando em http://localhost:3000")
})