<?php

namespace app\cms\controller;

class Ajax extends Base {
	public function getMyCommentList() {
		request()->uid = "30";
		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');

		$list = db('comment')->alias('a')
			->field('a.*,b.nickname,b.avatar')
			->join('member b', 'a.mid=b.mid', 'left')
			->where('a.mid', request()->uid)
			->where('a.sup_comment_id', 0)
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {
			$list[$k]['create_time'] = date('Y-m-d', $list[$k]['create_time']);

			$pics = json_decode(html_out($v['pics']), true);
			$pics_list = [];
			foreach ($pics as $key => $value) {
				$pics_list[] = $value['url'];
			}
			$list[$k]['pics'] = $pics_list;

			$comment_lists = db('comment')->alias('a')
				->field('a.*,b.nickname,b.avatar')
				->join('member b', 'a.mid=b.mid', 'left')
				->where('a.sup_comment_id', $v['comment_id'])
				->select()->toArray();

			foreach ($comment_lists as $ck => $cv) {
				$cpics = json_decode(html_out($cv['pics']), true);
				$cpics_list = [];
				foreach ($cpics as $ckey => $cvalue) {
					$cpics_list[] = $cvalue['url'];
				}
				$comment_lists[$ck]['create_time'] = date('Y-m-d', $comment_lists[$ck]['create_time']);
				$comment_lists[$ck]['pics'] = $cpics_list;
			}

			$list[$k]['list'] = $comment_lists;
		}

		return json(['status' => 200, 'data' => $list]);
	}

}
