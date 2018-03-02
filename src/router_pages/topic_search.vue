<template>
	<div id="topicSearch" class="container">
		<div class="row">
	        <div class="col s12 m7 l9">
	        	<component :is="topic_navbar" active="search" :user-info="userInfo" style="margin-bottom: 0;" class="z-depth-2"></component>
	        	<nav style="background-color: #1976D2; margin-bottom: 15px;">
		        	<div class="nav-wrapper">
		        		<form>
	    		        	<div class="input-field">
	    		        		<input id="search" type="search" placeholder="Search" v-model="searchInput" v-on:input="getQuestions" required>
	    		        		<label class="label-icon" for="search"><i class="material-icons">search</i></label>
	    		        		<i class="material-icons" v-on:click="clearSearch()">close</i>
	    			        </div>
	    		      	</form>
		        	</div>
		        </nav>
		        <component :is="question_list_item" v-for="question in questions" :merger-zites="mergerZites" :user-info="userInfo" :question="question" :show-name="true" :current-topic-address="topicAddress" v-on:update="getQuestions"></component>

				<ul class="pagination" v-if="questions.length != 0">
					<li><a href="#!" v-on:click.prevent="previousPage"><i class="material-icons">chevron_left</i></a></li>
					<li class="disabled"><a href="#!">{{ pageNum + 1 }}</a></li>
					<li><a href="#!" v-on:click.prevent="nextPage"><i class="material-icons">chevron_right</i></a></li>
				</ul>
	        </div>
	        <div class="col s12 m5 l3">
	        	<component :is="connected_topics" :merger-zites="mergerZites"></component>
	        </div>
	    </div>
	</div>
</template>

<script>
	var moment = require("moment");
	var Router = require("../libs/router.js");
	var TopicNavbar = require("../vue_components/topic_navbar.vue");
	var ConnectedTopics = require("../vue_components/connected_topics.vue");

	var QuestionListItem = require("../vue_components/question_list_item.vue");

	module.exports = {
		props: ["userInfo", "mergerZites"],
		name: "topicSearch",
		data: () => {
			return {
				topic_navbar: TopicNavbar,
				connected_topics: ConnectedTopics,
				question_list_item: QuestionListItem,
				topicName: "",
				topicAddress: "",
				searchInput: "",
				questions: [],
				pageNum: 0,
				isSearchStrict: false // TODO
			}
		},
		computed: {
			mergerZiteValues: function() {
				if (this.mergerZites == null) {
					return [];
				}
				return Object.values(this.mergerZites);
			},
			mergerZiteKeys: function() {
				if (this.mergerZites == null) {
					return [];
				}
				return Object.keys(this.mergerZites);
			}
		},
		beforeMount: function() {
			var self = this;

			this.$parent.$on("update", function() {
				self.getQuestions();
			});

			this.$parent.$on("setMergerZites", function(mergerZites) {
				self.manageMerger(mergerZites);
				self.getQuestions();
			});

			// If mergerZites is empty
			if (this.mergerZites && Object.keys(this.mergerZites).length != 0 && this.mergerZites.constructor === Object) {
				this.manageMerger(this.mergerZites);
				this.getQuestions();
			}
		},
		methods: {
			manageMerger: function(mergerZites) {
				if (this.topicAddress !== "" && this.topicName !== "") return;
				var self = this;
				if (!mergerZites[Router.currentParams["topicaddress"]]) {
					page.addMerger(Router.currentParams["topicaddress"])
						.then((mergerZites) => {
							self.topicName = mergerZites[Router.currentParams["topicaddress"]].content.title + " - ";
							self.topicAddress = Router.currentParams["topicaddress"];
						});
				} else {
					this.topicName = mergerZites[Router.currentParams["topicaddress"]].content.title + " - ";
					this.topicAddress = Router.currentParams["topicaddress"];
				}
			},
			getQuestions: function() {
				var self = this;

				page.getQuestionsTopicSearch(this.topicAddress, this.searchInput, this.pageNum)
					.then((questions) => {
						if (questions.length == 0 && self.pageNum != 0) {
							self.pageNum--;
							self.getQuestions();
							return;
						}
						self.questions = questions;
					});
			},
			goto: function(to) {
				Router.navigate(to);
			},
			isActive: function(address) {
				return Router.currentParams["topicaddress"] === address;
			},
			getDate: function(date) {
				return moment(date).fromNow();
			},
			previousPage: function() { // TODO: Scroll to top
				this.pageNum -= 1;
				if (this.pageNum <= 0) this.pageNum = 0;
				this.getQuestions();
			},
			nextPage: function() {
				this.pageNum += 1;
				this.getQuestions();
			},
			clearSearch: function() {
				this.searchInput = "";
				this.getQuestions();
			}
		}
	}
</script>