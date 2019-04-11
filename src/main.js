version = "0.1"

var anime = require("animejs");
window.anime = anime;
var Materialize = require("materialize-css/dist/js/materialize.min.js");

var MarkdownIt = require("markdown-it");
md = new MarkdownIt({
	html: false,
	linkify: true
});

var ZeroFrame = require("./libs/ZeroFrame.js");
var Router = require("./libs/router.js");

var Vue = require("vue/dist/vue.min.js");
var VueZeroFrameRouter = require("./libs/vue-zeroframe-router.js");
var searchDbQuery = require("./libs/search.js");

var { sanitizeStringForUrl, sanitizeStringForUrl_SQL, html_substr, sanitizeHtmlForDb } = require("./util.js");

Vue.use(VueZeroFrameRouter.VueZeroFrameRouter);

// Vue Components
var Navbar = require("./vue_components/navbar.vue");

var app = new Vue({
	el: "#app",
	template: `<div>
			<component ref="navbar" :is="navbar" :user-info="userInfo"></component>
			<component ref="view" :is="currentView" v-on:show-signin-modal="showSigninModal()" v-on:get-user-info="getUserInfo()" :user-info="userInfo" :merger-zites="mergerZites"></component>
		</div>`,
	data: {
		navbar: Navbar,
		currentView: null,
		siteInfo: null,
		userInfo: null,
		signin_modal_active: false,
		mergerZites: null
	},
	methods: {
		getUserInfo: function(f = null) { // TODO: This can be passed in a function as a callback
            if (this.siteInfo == null || this.siteInfo.cert_user_id == null) {
                this.userInfo = null;
                return;
            }

            console.log("Getting User Info");

            var that = this;

            that.userInfo = {
                cert_user_id: that.siteInfo.cert_user_id,
                auth_address: that.siteInfo.auth_address//,
                //keyvalue: keyvalue
            };
            that.$emit("setUserInfo", that.userInfo);
            if (f !== null && typeof f === "function") f();

            page.cmd("dbQuery", ["SELECT key, value FROM keyvalue LEFT JOIN json USING (json_id) WHERE cert_user_id=\"" + this.siteInfo.cert_user_id + "\" AND directory=\"data/users/" + this.siteInfo.auth_address + "\""], (rows) => {
				var keyvalue = {};
				console.log("Test");

                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    
                    keyvalue[row.key] = row.value;
                }
				
				// Automatically follow answers and comments to your questions
				var queryAnswers = `
					SELECT 'answer_' || REPLACE(answers_json.directory, 'data/users/', '') || '_' || answers.answer_id AS event_uri,
						'article' AS type,
						answers.date_added AS date_added,
						answers_json.cert_user_id || ' Answered Your Question "' || questions.title || '"' AS title,
						answers.body AS body,
						'?/' || questions_json.site || '/' || REPLACE(questions_json.directory, 'data/users/', '') || '/' || questions.question_id AS url
					FROM answers
					LEFT JOIN json AS answers_json USING (json_id)
					LEFT JOIN json AS questions_json ON questions_json.directory=('data/users/' || answers.question_auth_address)
					LEFT JOIN questions ON answers.question_id=questions.question_id AND questions.json_id=questions_json.json_id
					WHERE answers.question_auth_address="${that.userInfo.auth_address}"`;

				page.cmdp("feedFollow", [{"Answers": [queryAnswers, ""]}])
					.then((result) => console.log("FeedFollow: ", result));

				page.cmdp("dbQuery", [queryAnswers]).then((results) => console.log(results));

                //console.log("TESTING")

                /*if (!keyvalue.languages || keyvalue.languages === "") { // TODO: Might not need this check (this was from ZeroMedium originally)
                    that.language_modal_active = true;
                    that.$on("setUserLanguages", (languages) => {
                        that.keyvalue.languages = languages;
                        cache_remove("home_topics");
                        that.$emit("setUserInfo", that.userInfo); // TODO: Not sure if I need this if I can pass in a function callback instead
                        if (f !== null && typeof f === "function") f();
                        if (Router.currentRoute == "") {
                            that.$refs.view.getTopics();
                        }
                        /*page.getTopics((topics) => {
                            console.log(topics);
                            cache_add("home_topics", topics);
                        });*/ /*
                    });
                } else {*/
                    that.$emit("setUserInfo", that.userInfo); // TODO: Not sure if I need this if I can pass in a function callback instead
                    //cache_remove("home_topics");
                    if (f !== null && typeof f === "function") f();
                    /*if (Router.currentRoute == "") {
                        that.$refs.view.getTopics();
                    }*/
                    /*page.getTopics((topics) => {
                        console.log(topics);
                        cache_add("home_topics", topics);
                    });*/
                //}
            });
        }
	}
});

class ZeroApp extends ZeroFrame {
	onOpenWebsocket() {
		var self = this;

		this.cmdp("siteInfo", {})
			.then(siteInfo => {
				self.siteInfo = siteInfo;
				app.siteInfo = siteInfo;
				app.getUserInfo();
				//self.cmdp("wrapperNotification", ["info", "Loaded!"]);
				self.requestPermission("Merger:ZeroExchange", siteInfo, function() {
					self.cmdp("mergerSiteList", [true])
						.then((mergerZites) => {
							console.log(mergerZites);
							// Download ZeroNet topic by default
							if (!mergerZites["1J29rTU6VTtJQXkBPZzTZPjogdGNpfcBkr"]) {
								/*self.cmdp("mergerSiteAdd", ["1HhFcVz9sKDYes1oM6pUbqoVDnURr48mky"])
									.then(() => {
										self.cmdp("mergerSiteList", [true])
											.then((mergerZites) => {
												app.mergerZites = mergerZites;
											});
									});*/
								self.addMerger("1J29rTU6VTtJQXkBPZzTZPjogdGNpfcBkr")
									.then((mergerZites) => {
										app.$emit('setMergerZites', mergerZites);
										return self.cmdp("wrapperNotification", ["info", "You may need to refresh to see the Sandbox topic."]); // TODO
									});
							} else {
								app.mergerZites = mergerZites;
								app.$emit('setMergerZites', mergerZites);
							}
						});
				});
			});
	}

	requestPermission(permission, siteInfo, callback) {
		// Already have permission
		if (siteInfo.settings.permissions.indexOf(permission) > -1) {
			callback();
			return;
		}

		this.cmdp("wrapperPermissionAdd", [permission])
			.then(callback);
	}

	addMerger(ziteAddress) {
		var self = this;

		return this.cmdp("mergerSiteAdd", [ziteAddress])
			.then(() => {
				return self.cmdp("mergerSiteList", [true])
					.then((mergerZites) => {
						app.mergerZites = mergerZites;
						return mergerZites;
						//self.cmdp("wrapperOpenWindow", [self.siteInfo.address]);
					});
			});
	}

	onRequest(cmd, message) {
		Router.listenForBack(cmd, message);
		if (cmd === "setSiteInfo") {
			if (message.params.address == "1PHBjZSAc6mHDMkySJNs3XeSXUL7eY7Q7W") {
				this.siteInfo = message.params;
				app.siteInfo = message.params;
				app.getUserInfo();
			}
		}

		if (message.params.event[0] === "file_done") {
			app.$emit("update");
		}
	}

	selectUser() {
		return this.cmdp("certSelect", { accepted_domains: ["zeroid.bit", "kxoid.bit", "kaffie.bit", "cryptoid.bit", "peak.id"] });
    }

    signout() {
    	return this.cmdp("certSelect", { accepted_domains: [""] });
    }

    unimplemented() {
        return page.cmdp("wrapperNotification", ["info", "Unimplemented!"]);
    }

    postQuestion(currentTopicAddress, title, body, tags, beforePublishCB = null) {
    	if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to make a post."]);
    	} else if (!Router.currentParams["topicaddress"] && !currentTopicAddress) {
    		return this.cmdp("wrapperNotification", ["error", "You must choose a topic to post to."]);
    	}

    	var data_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				data = {};
    			}

    			if (!data["questions"]) data["questions"] = [];

    			var date = Date.now();

    			data["questions"].push({
    				"question_id": date,
    				"title": title,
    				"body": body,
    				"tags": tags,
    				"date_added": date
    			});

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", { "inner_path": content_inner_path })
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": date, "auth_address": self.siteInfo.auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": date, "auth_address": self.siteInfo.auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": date, "auth_address": self.siteInfo.auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}
	
	getQuestions(pageNum = 0, limit = 0) {
		var offset = pageNum * limit;
		var query = `
			SELECT * FROM questions
				LEFT JOIN json USING (json_id)
				WHERE site!='17PRT7jHB4TN1PMzgWbxDQYrUnWKX2bNcM' AND site!='1HhFcVz9sKDYes1oM6pUbqoVDnURr48mky'
				ORDER BY date_added DESC
				${limit != "" ? "LIMIT " + limit : ""}
				${limit != "" ? "OFFSET " + offset : ""}
			`;
    	return this.cmdp("dbQuery", [query]);
	}

	getQuestionsSearch(searchInput, pageNum = 0, limit = 5) {
		var query = searchDbQuery(this, searchInput, {
			orderByScore: true,
			id_col: "question_id",
			select: "*",
			searchSelects: [
				{ col: "title", score: 5 },
				{ col: "tags", score: 4 },
				{ col: "body", score: 1 }
			],
			table: "questions",
			where: "site!='17PRT7jHB4TN1PMzgWbxDQYrUnWKX2bNcM' AND site!='1HhFcVz9sKDYes1oM6pUbqoVDnURr48mky'",
			join: "LEFT JOIN json USING (json_id)",
			afterOrderBy: "date_added DESC",
			page: pageNum,
			limit: limit
		});
    	return this.cmdp("dbQuery", [query]);
	}

	getQuestionsRecent(limit = 5) {
		var query = `
			SELECT * FROM questions
				LEFT JOIN json USING (json_id)
				WHERE site!='17PRT7jHB4TN1PMzgWbxDQYrUnWKX2bNcM' AND site!='1HhFcVz9sKDYes1oM6pUbqoVDnURr48mky'
				ORDER BY date_added DESC
				LIMIT ${limit}
			`;
		return this.cmdp("dbQuery", [query]);
	}

	getQuestionsUser() {
		var auth_address = this.siteInfo.auth_address;
		var query = `
			SELECT * FROM questions
				LEFT JOIN json USING (json_id)
				WHERE directory='data/users/${auth_address}'
				AND site!='17PRT7jHB4TN1PMzgWbxDQYrUnWKX2bNcM' AND site!='1HhFcVz9sKDYes1oM6pUbqoVDnURr48mky'
				ORDER BY date_added DESC
			`;
		return this.cmdp("dbQuery", [query]);
	}

    getQuestion(currentTopicAddress, auth_address, question_id) {
    	var query = `
    		SELECT * FROM questions
    			LEFT JOIN json USING (json_id)
				WHERE site='${currentTopicAddress}'
    			AND directory='data/users/${auth_address}'
    			AND question_id=${question_id}
    			LIMIT 1
    		`;
    	return this.cmdp("dbQuery", [query]);
    }
	
    getQuestionsTopicSearch(currentTopicAddress, searchInput, pageNum = 0, limit = 5) {
    	/*var query = `
		SELECT * FROM questions
		LEFT JOIN json USING (json_id)
		WHERE site='${currentTopicAddress}'
		ORDER BY date_added DESC
		`;*/
		var query = searchDbQuery(this, searchInput, {
			orderByScore: true,
			id_col: "question_id",
			select: "*",
			searchSelects: [
				{ col: "title", score: 5 },
				{ col: "tags", score: 4 },
				{ col: "body", score: 1 }
			],
			table: "questions",
			where: "site='" + currentTopicAddress + "'",
			join: "LEFT JOIN json USING (json_id)",
			afterOrderBy: "date_added DESC",
			page: pageNum,
			limit: limit
		});
    	return this.cmdp("dbQuery", [query]);
	}

	getQuestionsTopicUser(currentTopicAddress, user_auth_address = null) {
		var auth_address = user_auth_address || this.siteInfo.auth_address;
		var query = `
			SELECT * FROM questions
				LEFT JOIN json USING (json_id)
				WHERE site='${currentTopicAddress}'
				AND directory='data/users/${auth_address}'
				ORDER BY date_added DESC
			`;
		return this.cmdp("dbQuery", [query]);
	}
	
	getQuestionsTopicRecent(currentTopicAddress, limit = 5) {
		var query = `
			SELECT * FROM questions
				LEFT JOIN json USING (json_id)
				WHERE site='${currentTopicAddress}'
				ORDER BY date_added DESC
				LIMIT ${limit}
			`;
		return this.cmdp("dbQuery", [query]);
	}

	questionMarkSolution(currentTopicAddress, question_id, question_auth_address, answer_id, answer_auth_address, beforePublishCB = null) {
		if (!this.siteInfo.auth_address) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to make a post."]);
    	} else if (!Router.currentParams["topicaddress"] && !currentTopicAddress) {
    		return this.cmdp("wrapperNotification", ["error", "You must choose a topic to post to."]);
		}

		if (question_auth_address !== this.siteInfo.auth_address) {
			return this.cmdp("wrapperNotification", ["error", "This question does not belong to you!"]);
		}
		
		var data_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/data.json";
		var content_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/content.json";
		
		var self = this;

		return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
			.then((data) => {
				if (!data) return false;
				data = JSON.parse(data);

				if (!data["questions"]) return false;

				var found = false;
				for (var i = 0; i < data["questions"].length; i++) {
					let question = data["questions"][i];

					if (question.question_id == question_id) {
						data["questions"][i]["solution_id"] = answer_id;
						data["questions"][i]["solution_auth_address"] = answer_auth_address;
						found = true;
						break;
					}
				}

				if (!found) return false;

				var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)]);
			}).then((res) => {
				if (res === "ok") {
    				return self.cmdp("siteSign", { "inner_path": content_inner_path });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
    			}
			}).then((res) => {
    			if (res === "ok") {
    				if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB();
    				return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
    			}
    		});
	}

	deleteQuestion(currentTopicAddress, question_id, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to delete a post."]);
    	} else if (!Router.currentParams["topicaddress"] && !currentTopicAddress) {
    		return this.cmdp("wrapperNotification", ["error", "Cannot delete a post that isn't in a topic."]);
    	}

    	var data_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/content.json";

		var self = this;
		return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				console.log("[main.js deleteQuestion] ERROR!");
					return;
    			}

    			if (!data["questions"]) {
					console.log("[main.js deleteQuestion] ERROR!");
					return;
				}
				
				for (var i = 0; i < data["questions"].length; i++) {
					var question = data["questions"][i];
					if (question.question_id == question_id) {
						data["questions"].splice(i, 1);
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

				return self.cmdp("wrapperConfirm", ["Are you sure?", "Delete"])
					.then((confirmed) => {
						if (confirmed) {
							return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)]);
						} else {
							return false;
						}
					});
			}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
					return self.cmdp("siteSign", { "inner_path": content_inner_path });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
    			}
    		}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
    				if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB();
    				return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
    			}
    		});
	}

    postAnswer(currentTopicAddress, question_id, question_auth_address, body, beforePublishCB = null) {
    	if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to make a post."]);
    	} else if (!Router.currentParams["topicaddress"] && !currentTopicAddress) {
    		return this.cmdp("wrapperNotification", ["error", "You must choose a topic to post to."]);
    	}

    	var data_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;

    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				data = {};
    			}

    			if (!data["answers"]) data["answers"] = [];

    			var date = Date.now();

    			data["answers"].push({
    				"answer_id": date,
    				"question_id": question_id,
    				"question_auth_address": question_auth_address,
    				"body": body,
    				"date_added": date
    			});

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)]);
    		}).then((res) => {
    			if (res === "ok") {
    				return self.cmdp("siteSign", { "inner_path": content_inner_path });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
    			}
    		}).then((res) => {
    			if (res === "ok") {
    				if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB();
    				return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
    			}
    		});
    }

    getQuestionAnswers(currentTopicAddress, question_id, question_auth_address) { // TODO: This query can probably be merged with the getQuestion query
    	var query = `
    		SELECT * FROM answers
    			LEFT JOIN json USING (json_id)
    			WHERE site='${currentTopicAddress}'
    			AND question_id=${question_id}
    			AND question_auth_address='${question_auth_address}'
    			ORDER BY date_added ASC
    		`;

    	return this.cmdp("dbQuery", [query]);
	}

	editAnswer(currentTopicAddress, answer_id, editText, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to edit a post."]);
    	} else if (!Router.currentParams["topicaddress"] && !currentTopicAddress) {
    		return this.cmdp("wrapperNotification", ["error", "Cannot edit a post that isn't in a topic."]);
    	}

    	var data_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/content.json";

		var self = this;
		return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				console.log("[main.js editAnswer] ERROR!");
					return;
    			}

    			if (!data["answers"]) {
					console.log("[main.js editAnswer] ERROR!");
					return;
				}
				
				for (var i = 0; i < data["answers"].length; i++) {
					var answer = data["answers"][i];
					if (answer.answer_id == answer_id) {
						data["answers"][i].body = editText;
						data["answers"][i].updated_date = Date.now();
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

				return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)]);
			}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
					return self.cmdp("siteSign", { "inner_path": content_inner_path });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
    			}
    		}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
    				if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB();
    				return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
    			}
    		});
	}

	upvoteAnswer(currentTopicAddress, answer_id, ref_auth_address, beforePublishCB) {
		// TODO
	}

	downvoteAnswer(currentTopicAddress, answer_id, ref_auth_address, beforePublishCB) {
		// TODO
	}
	
	deleteAnswer(currentTopicAddress, answer_id, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to delete a post."]);
    	} else if (!Router.currentParams["topicaddress"] && !currentTopicAddress) {
    		return this.cmdp("wrapperNotification", ["error", "Cannot delete a post that isn't in a topic."]);
    	}

    	var data_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/content.json";

		var self = this;
		return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				console.log("[main.js deleteAnswer] ERROR!");
					return;
    			}

    			if (!data["answers"]) {
					console.log("[main.js deleteAnswer] ERROR!");
					return;
				}
				
				for (var i = 0; i < data["answers"].length; i++) {
					var answer = data["answers"][i];
					if (answer.answer_id == answer_id) {
						data["answers"].splice(i, 1);
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

				return self.cmdp("wrapperConfirm", ["Are you sure?", "Delete"])
					.then((confirmed) => {
						if (confirmed) {
							return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)]);
						} else {
							return false;
						}
					});
			}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
					return self.cmdp("siteSign", { "inner_path": content_inner_path });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
    			}
    		}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
    				if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB();
    				return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
    			}
    		});
	}

    postComment(currentTopicAddress, reference_type, reference_id, reference_auth_address, body, beforePublishCB = null) {
    	if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to make a post."]);
    	} else if (!Router.currentParams["topicaddress"] && !currentTopicAddress) {
    		return this.cmdp("wrapperNotification", ["error", "You must choose a topic to post to."]);
    	}

    	var data_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				data = {};
    			}

    			if (!data["comments"]) data["comments"] = [];

    			var date = Date.now();

    			data["comments"].push({
    				"comment_id": date,
    				"reference_type": reference_type,
    				"reference_id": reference_id,
    				"reference_auth_address": reference_auth_address,
    				"body": body,
    				"date_added": date
    			});

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)]);
    		}).then((res) => {
    			if (res === "ok") {
    				return self.cmdp("siteSign", { "inner_path": content_inner_path });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
    			}
    		}).then((res) => {
    			if (res === "ok") {
    				if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB();
    				return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
    			}
    		});
    }

    getQuestionComments(currentTopicAddress, question_id, question_auth_address) {
    	var query = `
    		SELECT * FROM comments
    			LEFT JOIN json USING (json_id)
    			WHERE site='${currentTopicAddress}'
    			AND reference_type='q'
    			AND reference_id=${question_id}
    			AND reference_auth_address='${question_auth_address}'
    			ORDER BY date_added ASC
    		`;

    	return this.cmdp("dbQuery", [query]);
    }

    getAnswerComments(currentTopicAddress, answer_id, answer_auth_address) {
        var query = `
            SELECT * FROM comments
                LEFT JOIN json USING (json_id)
                WHERE site='${currentTopicAddress}'
                AND reference_type='a'
                AND reference_id=${answer_id}
                AND reference_auth_address='${answer_auth_address}'
                ORDER BY date_added ASC
            `;

        return this.cmdp("dbQuery", [query]);
	}

	editComment(currentTopicAddress, comment_id, editText, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to edit a post."]);
    	} else if (!Router.currentParams["topicaddress"] && !currentTopicAddress) {
    		return this.cmdp("wrapperNotification", ["error", "Cannot edit a post that isn't in a topic."]);
    	}

    	var data_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/content.json";

		var self = this;
		return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				console.log("[main.js editComment] ERROR!");
					return;
    			}

    			if (!data["comments"]) {
					console.log("[main.js editComment] ERROR!");
					return;
				}
				
				for (var i = 0; i < data["comments"].length; i++) {
					var comment = data["comments"][i];
					if (comment.comment_id == comment_id) {
						data["comments"][i].body = editText;
						data["comments"][i].updated_date = Date.now();
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

				return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)]);
			}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
					return self.cmdp("siteSign", { "inner_path": content_inner_path });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
    			}
    		}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
    				if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB();
    				return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
    			}
    		});
	}
	
	deleteComment(currentTopicAddress, comment_id, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to delete a post."]);
    	} else if (!Router.currentParams["topicaddress"] && !currentTopicAddress) {
    		return this.cmdp("wrapperNotification", ["error", "Cannot delete a post that isn't in a topic."]);
    	}

    	var data_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "merged-ZeroExchange/" + currentTopicAddress + "/data/users/" + this.siteInfo.auth_address + "/content.json";

		var self = this;
		return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				console.log("[main.js deleteComment] ERROR!");
					return;
    			}

    			if (!data["comments"]) {
					console.log("[main.js deleteComment] ERROR!");
					return;
				}
				
				for (var i = 0; i < data["comments"].length; i++) {
					var comment = data["comments"][i];
					if (comment.comment_id == comment_id) {
						data["comments"].splice(i, 1);
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

				return self.cmdp("wrapperConfirm", ["Are you sure?", "Delete"])
					.then((confirmed) => {
						if (confirmed) {
							return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)]);
						} else {
							return false;
						}
					});
			}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
					return self.cmdp("siteSign", { "inner_path": content_inner_path });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
    			}
    		}).then((res) => {
				if (res == false) return false;
    			if (res === "ok") {
    				if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB();
    				return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false });
    			} else {
    				return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
    			}
    		});
	}
}

page = new ZeroApp();

var Home = require("./router_pages/home.vue");
var HomeRecent = require("./router_pages/home_recent.vue");
var HomeMine = require("./router_pages/home_mine.vue");
var HomeSearch = require("./router_pages/home_search.vue");
var TopicHome = require("./router_pages/topic_home.vue");
var TopicMine = require("./router_pages/topic_mine.vue");
var TopicAsk = require("./router_pages/topic_ask.vue");
var TopicSearch = require("./router_pages/topic_search.vue");
var TopicQuestion = require("./router_pages/topic_question.vue");
var TopicQuestionAnswer = require("./router_pages/topic_question_answer.vue");
var TopicUser = require("./router_pages/topic_user.vue");
var About = require("./router_pages/about.vue");
var TopAvailable = require("./router_pages/top_available_topics.vue");

VueZeroFrameRouter.VueZeroFrameRouter_Init(Router, app, [
	{ route: "about", component: About },
	{ route: "top-available", component: TopAvailable },
	//{ route: "recent", component: HomeRecent },
	{ route: "mine", component: HomeMine },
	{ route: "search/:page", component: HomeSearch },
	{ route: "search", component: HomeSearch },
	{ route: ":topicaddress/mine", component: TopicMine },
	{ route: ":topicaddress/ask", component: TopicAsk },
	{ route: ":topicaddress/search/:page", component: TopicSearch },
	{ route: ":topicaddress/search", component: TopicSearch },
	{ route: ":topicaddress/:authaddress/:questionid/answer", component: TopicQuestionAnswer },
	{ route: ":topicaddress/:authaddress/:questionid", component: TopicQuestion },
	{ route: ":topicaddress/:authaddress", component: TopicUser },
	{ route: ":topicaddress", component: TopicHome },
	{ route: "", component: Home }
]);
