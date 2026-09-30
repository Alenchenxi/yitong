<?php

namespace app\api\controller;

class Task extends Common {

	function test() {

		$info['experience'][0]['title'] = '';
		$info['experience'][0]['start_time'] = '';
		$info['experience'][0]['end_time'] = '';
		$info['experience'][0]['experience'] = 343;
		dump($info['experience']);
		$info['experience'] = db('experience')->where('teacher_id', 3819)->select()->toArray();
		dump($info['experience']);
		// $list = db("teacher")->select()->toArray();
		// foreach ($list as $key => $value) {
		// 	$experience = db("experience")->where("teacher_id", $value['teacher_id'])->value("experience");
		// 	if ($experience) {
		// 		db("teacher")->where("teacher_id", $value['teacher_id'])->update(['introduction' => $experience]);
		// 	}
		// }

	}
	/**
	 * @api {post} /task/updateStickTime 01、 执行修改 置顶到期时间 (分钟)
	 * @apiGroup Task
	 * @apiVersion 1.0.0
	 * @apiDescription  执行修改 置顶到期时间
	 */
	public function updateStickTime() {
		$is_has = true;
		$page = 1;
		$limit = 20;
		while ($is_has) {

			$list = db('teacher')->where('stick_exp_time is not null')->limit(($page - 1) * $limit, $limit)->select()->toArray();
			//页码加1
			$page++;
			//如果没有内容 停止循环
			if (!$list) {
				$is_has = false;
			}

			foreach ($list as $k => $v) {

				//如果  到期时间小于 当前时间戳
				if ($v['stick_exp_time'] < time()) {

					//将置顶时间 和 置顶到期时间 置为null
					db('teacher')->where('teacher_id', $v['teacher_id'])->update(['stick_time' => null, 'stick_exp_time' => null]);
				}

			}

		}

	}

	/**
	 * @api {post} /task/updateTeacherRefreshTime 01、 执行修改 老师刷新到期时间 (每天)
	 * @apiGroup Task
	 * @apiVersion 1.0.0
	 * @apiDescription  执行修改 老师刷新到期时间 (每天)
	 */
	public function updateTeacherRefreshTime() {
		$is_has = true;
		$page = 1;
		$limit = 20;
		while ($is_has) {

			$list = db('teacher')->where('refresh_time is not null')->limit(($page - 1) * $limit, $limit)->select()->toArray();
			//页码加1
			$page++;
			//如果没有内容 停止循环
			if (!$list) {
				$is_has = false;
			}

			foreach ($list as $k => $v) {

				//将 刷新时间 置为null
				db('teacher')->where('teacher_id', $v['teacher_id'])->update(['refresh_time' => null]);

			}

		}

	}

	/**
	 * @api {post} /task/updateDemandRefreshTime 02、 执行修改 家长刷新到期时间 (每天)
	 * @apiGroup Task
	 * @apiVersion 1.0.0
	 * @apiDescription  执行修改 家长刷新到期时间 (每天)
	 */
	public function updateDemandRefreshTime() {
		$is_has = true;
		$page = 1;
		$limit = 20;
		while ($is_has) {

			$list = db('demand')->where('refresh_time is not null')->limit(($page - 1) * $limit, $limit)->select()->toArray();
			//页码加1
			$page++;
			//如果没有内容 停止循环
			if (!$list) {
				$is_has = false;
			}

			foreach ($list as $k => $v) {

				//将 刷新时间 置为null
				db('demand')->where('demand_id', $v['demand_id'])->update(['refresh_time' => null]);

			}

		}

	}

	/**
	 * @api {post} /task/updateDemandQrCode 03、 执行修改 家长需求小程序码
	 */
	public function updateDemandQrCode() {
		$is_has = true;
		$page = 1;
		$limit = 20;
		while ($is_has) {

			$list = db('demand')->limit(($page - 1) * $limit, $limit)->select()->toArray();
			//页码加1
			$page++;
			//如果没有内容 停止循环
			if (!$list) {
				$is_has = false;
			}

			foreach ($list as $k => $v) {

				$param = "demand_id=" . $v['demand_id'];

				//生成分享码
				$qrcode = qrcode(doOrderSn(00), $param);
				//将 刷新时间 置为null
				db('demand')->where('demand_id', $v['demand_id'])->update(['qrcode' => $qrcode]);

			}

		}

	}

	/**
	 * @api {post} /task/updateTeacherQrCode 02、 执行修改 老师简历小程序码
	 */
	public function updateTeacherQrCode() {
		$is_has = true;
		$page = 1;
		$limit = 20;
		while ($is_has) {

			$list = db('teacher')->limit(($page - 1) * $limit, $limit)->select()->toArray();
			//页码加1
			$page++;
			//如果没有内容 停止循环
			if (!$list) {
				$is_has = false;
			}

			foreach ($list as $k => $v) {

				$param = "teacher_id=" . $v['teacher_id'];

				//生成分享码
				$qrcode = qrcode(doOrderSn(00), $param);
				//将 刷新时间 置为null
				db('teacher')->where('teacher_id', $v['teacher_id'])->update(['qrcode' => $qrcode]);

			}

		}

	}

}
