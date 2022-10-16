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

				let authors = users.filter(u => u.author);

				if (authors.length == 0) {
					this.logger.info("Waiting for `users` seed...");
					setTimeout(this.seedDB, 1000);
					return;
				}

				// await this.adapter.insert({					
				// 		_id: "1",
				// 		title: "Docker (software).This article is about the OS-level virtualization software.",
				// 		content: "Docker is a set of platform as a service (PaaS) products that use OS-level virtualization to deliver software in packages called containers. The service has both free and premium tiers. The software that hosts the containers is called Docker Engine. It was first started in 2013 and is developed by Docker, Inc.\n\r Containers are isolated from one another and bundle their own software, libraries and configuration files; they can communicate with each other through well-defined channels. Because all of the containers share the services of a single operating system kernel, they use fewer resources than virtual machines.\n\rDocker can package an application and its dependencies in a virtual container that can run on any Linux, Windows, or macOS computer. This enables the application to run in a variety of locations, such as on-premises, in public (see decentralized computing, distributed computing, and cloud computing) or private cloud. When running on Linux, Docker uses the resource isolation features of the Linux kernel (such as cgroups and kernel namespaces) and a union-capable file system (such as OverlayFS) to allow containers to run within a single Linux instance, avoiding the overhead of starting and maintaining virtual machines. Docker on macOS uses a Linux virtual machine to run the containers.\n\rBecause Docker containers are lightweight, a single server or virtual machine can run several containers simultaneously. A 2018 analysis found that a typical Docker use case involves running eight containers per host, and that a quarter of analyzed organizations run 18 or more per host. It can also be installed on a single single board computer like the Raspberry Pi.\n\rThe Linux kernel's support for namespaces mostly isolates an application's view of the operating environment, including process trees, network, user IDs and mounted file systems, while the kernel's cgroups provide resource limiting for memory and CPU. Since version 0.9, Docker includes its own component (called libcontainer) to use virtualization facilities provided directly by the Linux kernel, in addition to using abstracted virtualization interfaces via libvirt, LXC and systemd-nspawn. \n\rDocker implements a high-level API to provide lightweight containers that run processes in isolation. Docker containers are standard processes, so it is possible to use kernel features to monitor their execution—including for example the use of tools like strace to observe and intercede with system calls.",
				// 		author: "Wikipedia",
				// 		likes: 5,
				// 		category: "Distributed Architecture",
				// 		coverPhoto: "doker.jpg",
				// 		createdAt: "15 October 2022 at 11:21"					  
				// });
				//Create fake posts
				let posts = await this.adapter.insertMany(_.times(20, () => {
					let fakePost = fake.entity.post();
					return {
						// title: fakePost.title,
						// content: fake.times(fake.lorem.paragraph, 10).join("\r\n"),
						// category: fake.random.arrayElement(["General", "Tech", "Social", "News"]),
						// author: fake.random.arrayElement(authors)._id,
						// coverPhoto: fake.random.number(1, 20) + ".jpg",
						// createdAt: fakePost.created

						title: "Docker (software).This article is about the OS-level virtualization software.",
						content: "Docker is a set of platform as a service (PaaS) products that use OS-level virtualization to deliver software in packages called containers. The service has both free and premium tiers. The software that hosts the containers is called Docker Engine. It was first started in 2013 and is developed by Docker, Inc.\n\r Containers are isolated from one another and bundle their own software, libraries and configuration files; they can communicate with each other through well-defined channels. Because all of the containers share the services of a single operating system kernel, they use fewer resources than virtual machines.\n\rDocker can package an application and its dependencies in a virtual container that can run on any Linux, Windows, or macOS computer. This enables the application to run in a variety of locations, such as on-premises, in public (see decentralized computing, distributed computing, and cloud computing) or private cloud. When running on Linux, Docker uses the resource isolation features of the Linux kernel (such as cgroups and kernel namespaces) and a union-capable file system (such as OverlayFS) to allow containers to run within a single Linux instance, avoiding the overhead of starting and maintaining virtual machines. Docker on macOS uses a Linux virtual machine to run the containers.\n\rBecause Docker containers are lightweight, a single server or virtual machine can run several containers simultaneously. A 2018 analysis found that a typical Docker use case involves running eight containers per host, and that a quarter of analyzed organizations run 18 or more per host. It can also be installed on a single single board computer like the Raspberry Pi.\n\rThe Linux kernel's support for namespaces mostly isolates an application's view of the operating environment, including process trees, network, user IDs and mounted file systems, while the kernel's cgroups provide resource limiting for memory and CPU. Since version 0.9, Docker includes its own component (called libcontainer) to use virtualization facilities provided directly by the Linux kernel, in addition to using abstracted virtualization interfaces via libvirt, LXC and systemd-nspawn. \n\rDocker implements a high-level API to provide lightweight containers that run processes in isolation. Docker containers are standard processes, so it is possible to use kernel features to monitor their execution—including for example the use of tools like strace to observe and intercede with system calls.",
						author: "Wikipedia",
						likes: 5,
						category: "Distributed Architecture",
						coverPhoto: "doker.jpg",
						createdAt: fakePost.created
					};
				}));
				// let users =  await this.adapter.insertMany(PostsData);
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
