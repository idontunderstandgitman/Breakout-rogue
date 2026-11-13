const express = require('express')
const bodyParser = require('body-parser');
const fs = require('fs')
const app = express()
const port = 4400

app.use(bodyParser.text({
    type: 'text/plain',
    limit:'1MB'
}));

app.get('/src/data/levels.json', (req, res) => {
    res.json(JSON.parse(fs.readFileSync('src/data/levels.json')))
})

app.post('/src/data/levels.json', (req, res) => {
    if(req.body?.trim()) {
        fs.writeFileSync('src/data/levels.json', req.body)
    }
    res.end('OK')
})

app.listen(port, () => {
  console.info(`Editor BE listening on port http://localhost:${port}`)
})
