"use strict";

const _ = require("lodash");
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const Post = require("../models/post.model");
const CacheCleaner = require("../mixins/cache.cleaner.mixin");
const Fakerator = require("fakerator");
const fake = new Fakerator();
const PostsData = require("../mixins/db/posts.json");

module.exports = {
	name: "posts",
	mixins: [DbService, CacheCleaner(["users", "likes"])],
	adapter: new MongooseAdapter(process.env.MONGO_URI || "mongodb://localhost/moleculer-blog", { useNewUrlParser: true, useUnifiedTopology: true }),
	model: Post,

	settings: {
		fields: ["_id", "title", "content", "author", "likes", "category", "coverPhoto", "createdAt"],
		populates: {
			author: {
				action: "users.get",
				params: {
					fields: ["_id", "username", "fullName", "avatar"]
				}
			},
			likes(ids, docs, rule, ctx) {
				return this.Promise.all(docs.map(doc => ctx.call("likes.count", { query: { post: doc._id } }).then(count => doc.likes = count)));
			}
			
		},
		pageSize: 5
	},

	actions: {

		like(ctx) {
			const users = await this.broker.call("users.find");
			let u_id = users.find(u => u.username==ctx.usermae)._id;
			let p_id = ctx.p_id;
			const like = await this.broker.call("likes.create",{post:p_id,user:u_id});
			return like;
		
		},

		unlike(ctx) {

		}

	},

	methods: {
		async seedDB() {
			try {
				this.logger.info("Seed Posts collection...");
				await this.waitForServices(["users"]);
				let users = await this.broker.call("users.find");
				if (users.length == 0) {
					this.logger.info("Waiting for `users` seed...");
					setTimeout(this.seedDB, 1000);
					return;
				}
				let authors = new Array();
				let authors1 = new Array();
				for(let i=0;i<PostsData.length;i++){
					authors[i] = users.find(u => u.username==PostsData[i].author)._id;
					//authors[i] = users.filter(u => PostsData[i].author)[0]._id;
				}

				let index = -1;
				await this.adapter.insertMany(_.times(PostsData.length, () => {
					index += 1;
					let fakePost = fake.entity.post();					
					let item = PostsData[index];
					return {
						title: item.title,
						content: item.content,
						author: authors[index],
						category: item.category,
						coverPhoto: item.coverPhoto,
						createdAt: fakePost.created
					};
				}));
				this.logger.info(`Generated ${posts.length} posts!`);
				return this.clearCache();
			} catch (error) {
				if (error.name == "ServiceNotFoundError") {
					this.logger.info("Waiting for `users` service...");
					setTimeout(this.seedDB, 1000);
					return;
				} else
					throw error;
			}
		}
	},

	async afterConnected() {
		const count = await this.adapter.count();
		if (count == 0) {
			return this.seedDB();
		}
	}

};
