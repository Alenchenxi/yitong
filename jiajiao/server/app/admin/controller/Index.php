<?php
namespace app\admin\controller;
use utils\Auth;

class Index extends Admin
{
	
	//框架主体
    public function index(){
		$menu = $this->getSubMenu(0);
		$cmsMenu = include app()->getRootPath().'/app/admin/controller/Cms/config.php';	//cms菜单配置
		if($cmsMenu){
			$menu = array_merge($cmsMenu,$menu);
		}
		$this->view->assign('menus',$menu);
		return view('index');
    }

	
	//生成左侧菜单栏
	private function getSubMenu($pid){
		$list = db("menu")->where(['status'=>1,'app_id'=>1,'pid'=>$pid])->order('sortid asc')->select();
		if($list){
			foreach($list as $key=>$val){
				$sublist = db("menu")->where(['status'=>1,'app_id'=>1,'pid'=>$val['menu_id']])->order('sortid asc')->select();
				if($sublist){
					$menus[$key]['sub'] = $this->getSubMenu($val['menu_id']);
				}
				$menus[$key]['title'] = $val['title'];
				$menus[$key]['icon'] = !empty($val['menu_icon']) ? $val['menu_icon'] : 'fa fa-clone';
				$menus[$key]['url'] = !empty($val['url']) ? (strpos($val['url'], '://') ? $val['url'] : url($val['url'])) :  url('admin/'.str_replace('/','.',$val['controller_name']).'/index');
				$menus[$key]['access_url'] = !empty($val['url']) ? $val['url'] :  'admin/'.str_replace('/','.',$val['controller_name']);
			}
			return $menus;
		}
	}
	
	
	//后台首页框架内容
	public function main(){
		/*
		$today_start = strtotime(date('Y-m-d 00:00:00'));
		$today_end = strtotime(date('Y-m-d 23:59:59'));
		
		$month_start = strtotime(date("Y-m-01"));
		$month_end = strtotime("+1 month -1 seconds", $month_start);
		
		//会员信息统计
		$memberWhere['is_vip'] = 1;
		
		$day['create_time'] = ['between',[$today_start,$today_end]];
		$month['create_time'] = ['between',[$month_start,$month_end]];
		
		$dayMemberTotal = db("member")->where(formatWhere(array_merge($memberWhere,$day)))->count();
		$monthMemberTotal = db("member")->where(formatWhere(array_merge($memberWhere,$month)))->count();
		$memberTotal = db("member")->where($memberWhere)->count();
		
		$transWhere['pay_type'] = ['in',[3,5,6]];
		$dayTransTotal = db("translation")->where(formatWhere(array_merge($transWhere,$day)))->sum('amount');
		$monthTransTotal = db("translation")->where(formatWhere(array_merge($transWhere,$month)))->sum('amount');
		$transTotal = db("translation")->where(formatWhere($transWhere))->sum('amount');
		
		$orderWhere['status'] = 4;
		$dayOrderTotal = db("order")->where(formatWhere(array_merge($orderWhere,$day)))->count();
		$monthOrderTotal = db("order")->where(formatWhere(array_merge($orderWhere,$month)))->count();
		$orderTotal = db("order")->where(formatWhere($orderWhere))->count();
		
		$dayCount = date("t");
		for($i=1; $i< $dayCount+1; $i++){
			$dt[] = $i;
			$t_start = strtotime(date('Y-m-'.$i.' 00:00:00'));
			$t_end = strtotime(date('Y-m-'.$i.' 23:59:59'));
			$d['create_time'] = ['between',[$t_start,$t_end]];
			$yj[] =  db("translation")->where(formatWhere(array_merge($transWhere,$d)))->sum('amount');
		}
		
		$mealWhere['shop_id'] = ['in',[2,3]];
		$mealWhere['real_price'] = ['>',0];
		$dayMealTotal = db("meal")->where(formatWhere(array_merge($mealWhere,$day)))->count();
		$monthMealTotal = db("meal")->where(formatWhere(array_merge($mealWhere,$month)))->count();
		$mealTotal = db("meal")->where(formatWhere($mealWhere))->count();
		
		$this->view->assign('dayMemberTotal',$dayMemberTotal);
		$this->view->assign('monthMemberTotal',$monthMemberTotal);
		$this->view->assign('memberTotal',$memberTotal);
		
		$this->view->assign('dayTransTotal',$dayTransTotal);
		$this->view->assign('monthTransTotal',$monthTransTotal);
		$this->view->assign('transTotal',$transTotal);
		
		$this->view->assign('dayOrderTotal',$dayOrderTotal);
		$this->view->assign('monthOrderTotal',$monthOrderTotal);
		$this->view->assign('orderTotal',$orderTotal);
		
		$this->view->assign('dayMealTotal',$dayMealTotal);
		$this->view->assign('monthMealTotal',$monthMealTotal);
		$this->view->assign('mealTotal',$mealTotal);
		

		$this->view->assign('daycounts',json_encode($dt));
		$this->view->assign('dayyj',json_encode($yj));
		*/

        $dsh_demand_num = db('demand')->where('status', 0)->count();
        $dsh_teacher_num = db('teacher')->where('status', 0)->count();

        $this->view->assign('dsh_demand_num',$dsh_demand_num);
        $this->view->assign('dsh_teacher_num',$dsh_teacher_num);

		return view('main');
	}
	
}
