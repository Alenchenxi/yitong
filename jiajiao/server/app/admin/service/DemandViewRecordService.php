<?php 
/*
 module:		生源/需求浏览记录
 create_time:	2022-09-21 11:21:21
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\DemandViewRecord;
use xhadmin\CommonService;

class DemandViewRecordService extends CommonService {

	/**
	 * 添加需求浏览记录
	 * @param $demand 需求信息
	 * @param $mid 会员id
	 * @param $teacher_id 教师id
	 */
	public static function addDemandViewRecord($demand, $mid, $teacher_id){
		if($mid){
			$rec = DemandViewRecord::where('demand_id', $demand['demand_id'])
			->where('mid', $mid)
			->find();
			if($rec){
				DemandViewRecord::where('id', $rec['id'])
				->update([
					'view_times' => $rec['view_times'] + 1,
					'view_time'  => time()
				]);
			}else{
				DemandViewRecord::create([
					'mid' => $mid,
					'teacher_id' => $teacher_id,
					'demand_mid' => $demand['mid'],
					'demand_id' => $demand['demand_id'],
					'view_times' => 1,
					'view_time' => time(),
					'create_time' => time(),
				]);
			}
		}
		db("demand")->where('demand_id', $demand['demand_id'])->update(['view_times' => $demand['view_times'] + 1]);
	}
	/**
	 * 获取用户需求浏览记录分页列表
	 * @param array $params 查询参数 {mid, demand_id}
	 * @param int $pageNum 页码
	 * @param int $pageSize 每页数量
	 * @return mixed
	 */
	public static function getUserDemandHistoryPage($where = [], $pageNum = 1, $pageSize = 6){
		$list = DemandViewRecord::where($where)
			->order('view_time', 'desc')
			->select();
		//遍历$list 获取 demand_id
		$demandIds = [];
		$listMap = [];
		foreach($list as $k=>$v){
			$demandIds[] = $v['demand_id'];
			$listMap[$v['demand_id']] = ['view_times' => $v['view_times'], 'view_time' => $v['view_time']];
		}
		//如果$demandIds 不为空
		if(empty($demandIds)){
			$data['list'] = [];
			return $data;
		}
		$demandList = db("demand")->alias('a')
			->field('a.*,b.name as subject_name,c.name as grade_name,d.name as category_name')
            ->join('subject b', 'a.subject_id=b.subject_id', 'left')
            ->join('grade c', 'a.grade_id=c.grade_id', 'left')
            ->join('category d', 'a.category_id=d.category_id', 'left')
            ->whereIn('a.demand_id', $demandIds)
            ->select();
		$newList = [];
		foreach ($demandList as $dk => $dv) {
			$item = json_decode(json_encode($dv), true);
			$matchRecord = $listMap[$item['demand_id']];
			if($matchRecord){
				$item['view_times'] = $matchRecord['view_times'];
				$item['view_time'] = date('Y-m-d', $matchRecord['view_time']);
			}
			$newList[] = $item;
        }
		$data['list'] = $newList;
		return $data;
	}

	/**
	 * 获取用户需求老师浏览记录分页列表
	 * @param array $params 查询参数 {demand_id}
	 * @param int $pageNum 页码
	 * @param int $pageSize 每页数量
	 * @return mixed
	 */
	public static function getDemandTeacherViewHistory($where = [], $pageNum = 1, $pageSize = 6){
		//DemandViewRecord distinct teacher_id
		$list = DemandViewRecord::where($where)
			->where('teacher_id', '<>', 0)
			->order('view_time', 'desc') -> select();
		//遍历$list 获取 demand_id
		$teacherIds = [];
		$listMap = [];
		foreach($list as $k=>$v){
			$teacherIds[] = $v['teacher_id'];
			$listMap[$v['mid']] = ['view_times' => $v['view_times'], 'view_time' => $v['view_time']];
		}
		//如果$teacherIds 不为空
		if(empty($teacherIds)){
			$data['list'] = [];
			return $data;
		}

		$teacherList = db('teacher')->whereIn('teacher_id', $teacherIds)->select();
		$newList = [];
		foreach ($teacherList as $tehacerk => $teacherv) {
			$item = json_decode(json_encode($teacherv), true);
            $main_subject = db('teaching_subject')->where('teacher_id', $item['teacher_id'])->where('is_main', 1)->find();
            if (! $main_subject) {
                $main_subject = db('teaching_subject')->where('teacher_id', $item['teacher_id'])->find();
            }

            $min_subject = db('teaching_subject')->where('teacher_id', $item['teacher_id'])->order('price asc')->find();

            $item['category_name'] = $main_subject['category_name'];
            $item['grade_name']    = $main_subject['grade_name'];
            $item['subject_name']  = $main_subject['subject_name'];
            $item['min_price']     = $min_subject['price'];
            $item['mobile']        = ''; // 强制覆盖 mobile
            if($item['birthday']){
               $item['age'] = getAgeFromBirthday($item['birthday']);
            }elseif($item['id_number']){
                $item['age'] = getAgeFromIdNo($item['id_number']);
            }

			$matchRecord = $listMap[$item['mid']];
			if($matchRecord){
				$item['view_times'] = $matchRecord['view_times'];
				$item['view_time'] = date('Y-m-d', $matchRecord['view_time']);
			}
			$newList[] = $item;
        }
		$data['list'] = $newList;
		return $data;
	}
}

