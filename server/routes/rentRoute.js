const express = require('express')
const rentRoute = express.Router()
const {check, validationResult} = require('express-validator')

//db config
const { Client } = require('pg')
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true
})

client.connect()

rentRoute.get('/', [
    check('compare').isIn(['greater', 'less']).withMessage('Incorrect comparison string entered'),
    check('avgRent').isInt().withMessage('Rent must be a number'),
    check('quantity').isInt().withMessage('Quantity must be a number'),
    check('key').isIn(process.env.API_CLIENT_KEY.split(',')).withMessage('invalid client key')

], (req, res) => {

    const inputError = validationResult(req)
    
    if (!inputError.isEmpty()) {
        return res.status(422).json({ errors: inputError.array()})
    }

    const compare = req.query.compare
    const avgRent = req.query.avgRent
    const quantity = req.query.quantity
    const key = req.query.key
    const date_format = new Intl.DateTimeFormat('en-us', { dateStyle: 'short' })

    const current_date = date_format.format(new Date())

    let compareQuery

    client.query(`SELECT to_char(last_date :: DATE, 'mm/dd/yyyy') as last_date, api_calls FROM api_key_limit WHERE key = '${key}'`)
    .then(d => {
        let api_last_date = d.rows[0].last_date
        let api_calls = d.rows[0].api_calls
        if (api_last_date != current_date)
        {
            client.query(`UPDATE api_key_limit SET api_calls = 1, last_date = '${current_date}' WHERE key = '${key}'`)
        }
        else if (api_last_date === current_date && api_calls < process.env.API_CLIENT_MAX)
        {
            client.query(`UPDATE api_key_limit SET api_calls = api_calls + 1 WHERE key = '${key}'`)
        }
        else {
            return res.status(422).json({ errors: 'API Limit Reached'}) 
        }
    })
    
    compare === 'greater' ? compareQuery = '>' : compareQuery = '<'

   client.query(`SELECT city, state, avg_rent FROM city_rents WHERE avg_rent ${compareQuery} ${avgRent} LIMIT ${quantity}`)
    .then(result => res.json(result))
    .catch((e) => console.log(e))
})

module.exports = rentRoute