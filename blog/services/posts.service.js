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
		fields: ["_id", "title", "content", "author", "likes", "category", "coverPhoto", "createdAt","similarity","similarity_id"],
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
	},

	similar(s, t, f) {
		if (!s || !t) {
		  return 0
		}
		if(s === t){
		  return 100;
		}
		var l = s.length > t.length ? s.length : t.length
		var n = s.length
		var m = t.length
		var d = []
		f = f || 2
		var min = function (a, b, c) {
		  return a < b ? (a < c ? a : c) : (b < c ? b : c)
		}
		var i, j, si, tj, cost
		if (n === 0) return m
		if (m === 0) return n
		for (i = 0; i <= n; i++) {
		  d[i] = []
		  d[i][0] = i
		}
		for (j = 0; j <= m; j++) {
		  d[0][j] = j
		}
		for (i = 1; i <= n; i++) {
		  si = s.charAt(i - 1)
		  for (j = 1; j <= m; j++) {
			tj = t.charAt(j - 1)
			if (si === tj) {
			  cost = 0
			} else {
			  cost = 1
			}
			d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
		  }
		}
		let res = (1 - d[n][m] / l) *100
		return res.toFixed(f)
	},
	  

	// async entityCreated(json, ctx) {
	// 	let content = json.content;
	// 	const allPosts = await this.adapter.find();
	// 	let minSimi = 0;
	// 	let simiID = json._id;
	// 	for (let i = 0;i<allPosts.length;i++){
	// 		if(allPosts[i]._id==json._id){
	// 			continue;
	// 		}
	// 		let simi = this.similar(content,allPosts[i].content,2);
	// 		if (simi >minSimi){
	// 			minSimi = simi;
	// 			simiID = allPosts[i]._id;
	// 		}
	// 	}
	// 	// return this.adapter.update({id:json._id,similarity:minSimi,similarity_id:simiID});		
	// }

};
