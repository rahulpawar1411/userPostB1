const mongoose = require('mongoose');

const postSchema = mongoose.Schema({
    title: String,
    description: String,
    img: String,
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    date:{
        type:Date,
        default:Date.now,
    }
})

module.exports = mongoose.model('post', postSchema)