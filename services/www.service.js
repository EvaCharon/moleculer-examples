"use strict";

const { MoleculerError } = require("moleculer").Errors;
const path = require("path");
/**
 * Define Express Req. and Res. Types
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */
const express = require("express");
const morgan = require("morgan");
const _ = require("lodash");
const moment = require("moment");
const slugify = require("slugify");
const Hashids = require("hashids/cjs");
const ejs = require('ejs');
const hashids = new Hashids("secret hash", 6);
const Fakerator = require("fakerator");
const fake = new Fakerator();

function encodeObjectID(id) {
	return hashids.encodeHex(id);
}

function decodeObjectID(id) {
	return hashids.decodeHex(id);
}

module.exports = {
	name: "www",

	settings: {
		port: process.env.PORT || 3000,
		pageSize: 5,
	},

	methods: {
		initRoutes(app) {
			app.get("/", this.allPosts);
			app.get("/hasLogin/:user_id/:ifLogin", this.allPostsAfterLogin);
			app.get("/search/:user_id/:ifLogin", this.searchPosts);
			app.get("/category/:category/:user_id/:ifLogin", this.categoryPosts);
			app.get("/author/:author/:user_id/:ifLogin", this.authorPosts);
			app.get("/post/:user_id/:ifLogin/:id/:title?", this.getPost);
			app.get("/loginPage", this.loginPage);
			app.get("/registerPage", this.registerPage);
			app.get("/login",this.login);
			app.get("/register",this.register);
			app.get("/userHome/:user_id/:ifLogin");
			app.get("/like/:post_id/:user_id/:ifLogin",this.like);
			app.get("/edit/:user_id/:ifLogin",this.editPost);
			app.get("/createPost/:user_id/:ifLogin",this.createPost)
			app.get("/home/:user_id/:ifLogin",this.backHome)
			app.get("/mylike/:user_id/:ifLogin",this.myLike)
		},

		/**
		 *
		 * @param {Request} req
		 * @param {Response} res
		 */
		 async myLike(req, res){
			let name = req.params.user_id;
			const data = await this.broker.call("users.find",{query:{username:name}});
			
			const users = await this.broker.call("users.find");
			let user = users.find(u => u.username==name);
			const alllikes = await this.broker.call("likes.list", {query:{user:user._id},populate:["post"]});
			let pageContents = {
				posts:alllikes.rows,
				currentUser: [data[0]],
				ifLogin: true
			}
			return res.render("userLike",pageContents);	
		 },
		/**
		 *
		 * @param {Request} req
		 * @param {Response} res
		 */
		 async editPost(req, res){
			let u_id = req.params.user_id;
			
			try{
				let pageContents = {
					msg : "",
					ifLogin: true,
					currentUser:{}
				};
				if(pageContents.ifLogin){
					if (!u_id || u_id.length == 0)
						throw this.handleErr(res)(new MoleculerError("Invalid user ID", 404, "INVALID_User_ID", { user_id: u_id }));
					const currentUser = await this.broker.call("users.find", {query:{username:u_id}});
					pageContents.currentUser = currentUser;
				}
				return res.render("edit",pageContents);
			}catch (error) {
				return this.handleErr(error);
			}
		 },
		 /**
		 *
		 * @param {Request} req
		 * @param {Response} res
		 */
		async createPost(req, res){
			const pageSize = this.settings.pageSize;
			const page = Number(req.query.page || 1);
			let name = req.params.user_id;
			const users = await this.broker.call("users.find");
			let user = users.find(u => u.username==req.params.user_id);
			try{
			
			let fakePost = fake.entity.post();			
			let postInfo = {
				title: req.query.title,
				content: req.query.content,
				author: user._id,
				category: req.query.category,
				// coverPhoto: item.coverPhoto,
				coverPhoto: ""+fake.random.number(1, 5)+".jpg",
				createdAt: fakePost.created
			};
				const created = await this.broker.call("posts.create",postInfo);				
				const similarity = await this.broker.call("posts.getSimilarity", { id:created._id });
				let pageContents = {
					post : created,
					title : created.title,
					ifLogin :(req.params.user_id != "0"),
					currentUser:{}
				};
			
				if(pageContents.ifLogin){
					const currentUser = await this.broker.call("users.find", {query:{username:name}});
					pageContents.currentUser = currentUser;
				}
				pageContents.post.author = user;
				pageContents.post.similarity = similarity;
				pageContents = await this.appendAdditionalData(pageContents);
				return res.render("post", pageContents);
			
			}catch(error) {
				return this.handleErr(error);
			}
		},
		/**
		 *
		 * @param {Request} req
		 * @param {Response} res
		 */
		async like(req, res) {
			const pageSize = this.settings.pageSize;
			const page = Number(req.query.page || 1);
			let name = req.params.user_id;
			let p_id = decodeObjectID(req.params.post_id);
			try {
				const users = await this.broker.call("users.find");
				let user = users.find(u => u.username==name);
				const ifLike = await this.broker.call("likes.find", {query:{user:user._id,post:p_id}});
				if(ifLike.length==0){
					await this.broker.call("likes.create",{
							user: user._id,
							post: p_id
					});

				}
				const data = await this.broker.call("posts.list", { page, pageSize, populate: ["author", "likes"] });				
					let pageContents = {
						posts : data.rows,
						totalPages: data.totalPages,
						ifLogin: (req.params.user_id != "0"),
						currentUser:[user],
						page: page
					};
					if(pageContents.ifLogin){
						const currentUser = await this.broker.call("users.find", {query:{username:name}});
						pageContents.currentUser = currentUser;
					}
					pageContents = await this.appendAdditionalData(pageContents);
					return res.render("index", pageContents);				
			} catch (error) {
				return this.handleErr(error);
			}
		},
		/**
		 *
		 * @param {Request} req
		 * @param {Response} res
		 */
		async allPostsAfterLogin(req, res) {
			const pageSize = this.settings.pageSize;
			const page = Number(req.query.page || 1);
			
			try {
				const data = await this.broker.call("posts.list", { page, pageSize, populate: ["author", "likes"] });
				
				console.log(data.rows);
				let pageContents = {
					posts : data.rows,
					totalPages: data.totalPages,
					ifLogin: (req.params.user_id != "0"),
					currentUser:{},
					page: page
					
				};
				if(pageContents.ifLogin){
					let u_id = req.params.user_id;
					if (!u_id || u_id.length == 0)
						throw this.handleErr(res)(new MoleculerError("Invalid user ID", 404, "INVALID_User_ID", { user_id: u_id }));
					const currentUser = await this.broker.call("users.find", {query:{username:u_id}});
					pageContents.currentUser = currentUser;
				}else{
					pageContents.Login = false;
				}
				pageContents = await this.appendAdditionalData(pageContents);
				return res.render("index", pageContents);
			} catch (error) {
				return this.handleErr(error);
			}
		},

		async allPosts(req, res) {
			const pageSize = this.settings.pageSize;
			const page = Number(req.query.page || 1);
			try {
				const data = await this.broker.call("posts.list", { page, pageSize, populate: ["author", "likes"] });
				console.log(data.rows);
				let pageContents = {
					posts : data.rows,
					totalPages: data.totalPages,
					ifLogin: false,
					page:page
				};
				pageContents = await this.appendAdditionalData(pageContents);
				return res.render("index", pageContents);
			} catch (error) {
				return this.handleErr(error);
			}
		},

		/**
		 *
		 * @param {Request} req
		 * @param {Response} res
		 */
		async categoryPosts(req, res) {
			const pageSize = this.settings.pageSize;
			const page = Number(req.query.page || 1);
			const category = req.params.category;
			let u_id = req.params.user_id;
			
			try {
				const data = await this.broker.call("posts.list", { query: { category }, page, pageSize, populate: ["author", "likes"] });

				let pageContents = {
					posts : data.rows,
					totalPages: data.totalPages,
					ifLogin: (u_id!=0),
					currentUser: {},
					page: page
				};
				if(pageContents.ifLogin){
				
					if (!u_id || u_id.length == 0)
						throw this.handleErr(res)(new MoleculerError("Invalid user ID", 404, "INVALID_User_ID", { user_id: u_id }));
					const currentUser = await this.broker.call("users.find", {query:{username:u_id}});
					pageContents.currentUser = currentUser;
				}
				pageContents = await this.appendAdditionalData(pageContents);
				return res.render("index", pageContents);
			} catch (error) {
				return this.handleErr(error);
			}
		},

		/**
		 *
		 * @param {Request} req
		 * @param {Response} res
		 */
		async authorPosts(req, res) {
			const pageSize = this.settings.pageSize;
			let page = Number(req.query.page || 1);
			let author = decodeObjectID(req.params.author);

			if (!author || author.length == 0)
				throw this.handleErr(res)(new MoleculerError("Invalid author ID", 404, "INVALID_AUTHOR_ID", { author: req.params.author }));

			try {
				const data = await this.broker.call("posts.list", { query: { author }, page, pageSize, populate: ["author", "likes"] });

				let pageContents = {
					posts : data.rows,
					totalPages: data.totalPages,
					ifLogin: (req.params.user_id != "0"),
					currentUser:{},
					page: page
				};
				if(pageContents.ifLogin){
					let u_id = req.params.user_id;
					if (!u_id || u_id.length == 0)
						throw this.handleErr(res)(new MoleculerError("Invalid user ID", 404, "INVALID_User_ID", { user_id: u_id }));
					const currentUser = await this.broker.call("users.find", {query:{username:u_id}});
					pageContents.currentUser = currentUser;
				}
				pageContents = await this.appendAdditionalData(pageContents);
				return res.render("index", pageContents);
			} catch (error) {
				return this.handleErr(error);
			}
		},

		/**git
		 *
		 * @param {Request} req
		 * @param {Response} res
		 */
		async searchPosts(req, res) {
			const pageSize = this.settings.pageSize;
			let page = Number(req.query.page || 1);
			let search = req.query.query;
			if (!search)
				return res.redirect("/");

			try {
				const data = await this.broker.call("posts.list", { search, page, pageSize, populate: ["author", "likes"] });

				let pageContents = {
					query : search,
					posts : data.rows,
					totalPages: data.totalPages,
					ifLogin :(req.params.user_id != "0"),
					currentUser:{},
					page: page
				};
				if(pageContents.ifLogin){
					let u_id = req.params.user_id;
					if (!u_id || u_id.length == 0)
						throw this.handleErr(res)(new MoleculerError("Invalid user ID", 404, "INVALID_User_ID", { user_id: u_id }));
					const currentUser = await this.broker.call("users.find", {query:{username:u_id}});
					pageContents.currentUser = currentUser;
				}
				pageContents = await this.appendAdditionalData(pageContents);
				return res.render("index", pageContents);
			} catch (error) {
				return this.handleErr(error);
			}
		},

		/**
		 * Get post by ID
		 * @param {Request} req
		 * @param {Response} res
		 */
		async getPost(req, res) {
			let id = decodeObjectID(req.params.id);
			
			if (!id || id.length == 0)
				return this.handleErr(res)(this.Promise.reject(new MoleculerError("Invalid POST ID", 404, "INVALID_POST_ID", { id: req.params.id })));

			try {
				const post = await this.broker.call("posts.get", { id, populate: ["author", "likes"] });
				const similarity = await this.broker.call("posts.getSimilarity", { id:id });
				if (!post)
					throw new MoleculerError("Post not found", 404, "NOT_FOUND_POST", { id: req.params.id });


				let pageContents = {
					post : post,
					title : post.title,
					ifLogin :(req.params.user_id != "0"),
					currentUser:{}
				};
				pageContents.post.similarity = similarity;
				if(pageContents.ifLogin){
					let u_id = req.params.user_id;
					if (!u_id || u_id.length == 0)
						throw this.handleErr(res)(new MoleculerError("Invalid user ID", 404, "INVALID_User_ID", { user_id: u_id }));
					const currentUser = await this.broker.call("users.find", {query:{username:u_id}});
					pageContents.currentUser = currentUser;
				}
				pageContents = await this.appendAdditionalData(pageContents);
				return res.render("post", pageContents);
			} catch (error) {
				return this.handleErr(error);
			}	
		},
		
		/**
		 * redirect to login page
		 * @param {Request} req
		 * @param {Response} res
	 	*/
		async loginPage(req,res) {
			let pageContents = {
				msg : "",
				ifLogin: false
			};
			return res.render("login",pageContents);
		},			
		
		/**
		 * redirect to register page
		 * @param {Request} req
		 * @param {Response} res
	 	*/
		 async registerPage(req,res) {
			let pageContents = {
				msg : "",
				ifLogin: false
			};
			return res.render("register",pageContents);
		},

		/**
		 * redirect to register page
		 * @param {Request} req
		 * @param {Response} res
	 	*/
		async login(req,res) {
			let name = req.query.username;
			name = name.toLowerCase();
			let pwd = req.query.pwd;
			let errorMsg = "";
			try{
				const data = await this.broker.call("users.find",{query:{username:name}});
				
				if (data.length == 0){
					errorMsg = "Username doesn't exist.";
				}
				else if(data[0].password!=pwd){
					errorMsg = "Password is incorrect."
				}
				let pageContents = {
					msg : errorMsg,
					ifLogin: false
				};

				

				if(data[0].password == pwd){
					//const likes = await this.broker.call("likes.list",{query:{user:data[0]._id},populate:['post']});
					const own =  await this.broker.call("posts.list", { query: { author:data[0]._id }, populate: ["author", "likes"] });
					pageContents = {
						posts:own.rows,
						currentUser: [data[0]],
						ifLogin: true
					}
					return res.render("userHome",pageContents);
				}
				return res.render("login", pageContents);
			} catch (error) {
				return this.handleErr(error);
			}	
				
		},
		/**
		 * redirect to register page
		 * @param {Request} req
		 * @param {Response} res
	 	*/
		 async backHome(req,res) {
			let name = req.params.user_id;
			const data = await this.broker.call("users.find",{query:{username:name}});
			

			//const likes = await this.broker.call("likes.list",{query:{user:data[0]._id},populate:['post']});
			
			const own =  await this.broker.call("posts.list", { query: { author:data[0]._id }, populate: ["author", "likes"] });
			let pageContents = {
				posts:own.rows,
				currentUser: [data[0]],
				ifLogin: true
			}
			return res.render("userHome",pageContents);		
		},

		/**
		 * redirect to register 
		 * @param {Request} req
		 * @param {Response} res
	 	*/
		 async register(req,res) {
			let name = req.query.username;
			name = name.toLowerCase();
			let errorMsg = "";

			try{
				const data = await this.broker.call("users.find",{query:{username:name}});
				console.log(data);
				if(req.query.pwd != req.query.repeatpwd){
					errorMsg = "Repeat password wrong."
					let pageContents = {
						msg : errorMsg,
						ifLogin: false
					};
				return res.render("register", pageContents);
				}else if (data.length != 0){
					errorMsg = "Username exists.";
					let pageContents = {
						msg : errorMsg,
						ifLogin: false
					};
				return res.render("register", pageContents);
				}
				let userInfo = {
					username: name,
					password: req.query.pwd,
					fullName: req.query.fullname,
					email: req.query.email,
					avatar: fake.internet.avatar(),
					author: false
				};
				const created = await this.broker.call("users.create",userInfo);				
				// const likes = await this.broker.call("likes.list",{query:{user:created._id},populate:['user','post']});
				const own =  await this.broker.call("posts.list", { query: { author:created._id }, populate: ["author", "likes"] });
				let	pageContents = {
					posts:own.rows,
					currentUser: [created],
					ifLogin: true
				}
				return res.render("userHome",pageContents);
			} catch (error) {
				return this.handleErr(error);
			}		
		},

		async appendAdditionalData(data) {
			data.bestOfPosts = await this.broker.call("posts.find", { limit: 5, sort: "-createdAt" });
			return data;
		},

		/**cd
		 * @param {Response} res
		 */
		handleErr(res) {
			return err => {
				this.logger.error("Request error!", err);

				res.status(err.code || 500).send(err.message);
			};
		}
	},


	created() {
		const app = express();
		const baseFolder = path.join(__dirname, "..");

		app.locals._ = _;
		app.locals.truncateContent = val => _.truncate(val, { length: 200 });
		app.locals.moment = moment;
		app.locals.slugify = slugify;
		app.locals.encodeObjectID = encodeObjectID;
		//app.locals.decodeObjectID = decodeObjectID;

		app.set("etag", true);
		app.enable("trust proxy");

		app.use(express["static"](path.join(baseFolder, "public")));

		// Init morgan
		let stream = require("stream");
		let lmStream = new stream.Stream();

		lmStream.writable = true;
		lmStream.write = data => this.logger.info(data);

		app.use(morgan("dev", {
			stream: lmStream
		}));

		// Set view folder
		app.set("views", path.join(baseFolder, "views"));
		app.engine('.html',ejs.__express);
		app.set("view engine", "html");


		if (process.env.NODE_ENV == "production") {
			app.locals.cache = "memory";
			app.set("view cache", true);
		} else {
			// Disable views cache
			app.set("view cache", false);
		}

		this.initRoutes(app);
		this.app = app;
	},

	started() {
		this.app.listen(Number(this.settings.port), err => {
			if (err)
				return this.broker.fatal(err);

			this.logger.info(`WWW server started on port ${this.settings.port}`);
		});

	},

	stopped() {
		if (this.app.listening) {
			this.app.close(err => {
				if (err)
					return this.logger.error("WWW server close error!", err);

				this.logger.info("WWW server stopped!");
			});
		}
	}
};
