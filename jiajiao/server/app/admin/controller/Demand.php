<?php 
/*
 module:		家长发布
 create_time:	2023-07-22 16:28:53
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\DemandService;
use app\admin\model\Demand as DemandModel;
use app\admin\service\DemandViewRecordService;
use think\facade\Db;

class Demand extends Admin {


	/*删除*/
	function delete(){
		$idx =  $this->request->post('demand_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			DemandModel::destroy(['demand_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*查看详情*/
	function view(){
		$demand_id = $this->request->get('demand_id','','serach_in');
		if(!$demand_id) $this->error('参数错误');
		$info = Db::connect('mysql')->query('select a.*,b.name as subject_name,c.name as grade_name from cd_demand a left join cd_subject b on a.subject_id=b.subject_id left join cd_grade c on a.grade_id=c.grade_id where a.demand_id = '.$demand_id);
		$this->view->assign('info',current($info));
		return view('view');
	}

 /*start*/
    /*首页数据列表*/
    function index(){
        if (!$this->request->isAjax()){
            return view('index');
        }else{
            $limit  = $this->request->post('limit', 20, 'intval');
            $offset = $this->request->post('offset', 0, 'intval');
            $page   = floor($offset / $limit) +1 ;

            $where = [];
            $where['a.sn'] = $this->request->param('sn', '', 'serach_in');
            $where['a.name'] = ['like',$this->request->param('name_s', '', 'serach_in')];
            $where['a.mobile'] = ['like',$this->request->param('mobile', '', 'serach_in')];
            $where['a.teaching_way'] = $this->request->param('teaching_way', '', 'serach_in');
            $where['a.category_id'] = $this->request->param('category_id', '', 'serach_in');
            $where['a.grade_id'] = $this->request->param('grade_id', '', 'serach_in');
            $where['a.subject_id'] = $this->request->param('subject_id', '', 'serach_in');
            $where['a.province'] = $this->request->param('province', '', 'serach_in');
            $where['a.city'] = $this->request->param('city', '', 'serach_in');
            $where['a.area'] = $this->request->param('area', '', 'serach_in');

            $create_time_start = $this->request->param('create_time_start', '', 'serach_in');
            $create_time_end = $this->request->param('create_time_end', '', 'serach_in');

            $where['a.create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];
            $where['a.status'] = $this->request->param('status', '', 'serach_in');

            $ext_no = $this->request->param('ext_no', '', 'serach_in');
            if($ext_no){
                $where['a.ext_no'] = ['like',$ext_no];
            }
            $order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
            $sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

            $field = '';
            $orderby = ($sort && $order) ? $sort.' '.$order : 'stick_time desc,demand_id desc';

            $sql = 'select a.*,b.name as subject_name,c.name as grade_name from cd_demand a left join cd_subject b on a.subject_id=b.subject_id left join cd_grade c on a.grade_id=c.grade_id';
            $limit = ($page-1) * $limit.','.$limit;
            $res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);
            return json($res);
        }
    }

    /*首页数据列表*/
    function index1(){
        if (!$this->request->isAjax()){
            return view('index');
        }else{
            $limit  = $this->request->post('limit', 20, 'intval');
            $offset = $this->request->post('offset', 0, 'intval');
            $page   = floor($offset / $limit) +1 ;

            $where = [];
            $where['a.sn'] = $this->request->param('sn', '', 'serach_in');
            $where['a.teach_fee_id'] = $this->request->param('teach_fee_id', '', 'serach_in');
            $where['a.linkman'] = ['like',$this->request->param('linkman', '', 'serach_in')];
            $where['a.mobile'] = ['like',$this->request->param('mobile', '', 'serach_in')];

            $create_time_start = $this->request->param('create_time_start', '', 'serach_in');
            $create_time_end = $this->request->param('create_time_end', '', 'serach_in');

            $where['a.create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];
            $where['a.status'] = $this->request->param('status', '', 'serach_in');
            $where['a.is_real_pay'] = $this->request->param('is_real_pay', '', 'serach_in');
            $where['a.is_refund'] = $this->request->param('is_refund', '', 'serach_in');
            $where['a.is_hide'] = $this->request->param('is_hide', '', 'serach_in');

            $where['province'] = ['like',$this->request->param('province', '', 'serach_in')];
            $where['city'] = ['like',$this->request->param('city', '', 'serach_in')];
            $where['area'] = ['like',$this->request->param('area', '', 'serach_in')];

            $order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
            $sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

            $field = '';
            $orderby = ($sort && $order) ? $sort.' '.$order : 'create_time desc,demand_id desc';

            $sql = 'select a.*,b.name as subject_name from cd_demand a left join cd_subject b on a.subject_id=b.subject_id';
            $limit = ($page-1) * $limit.','.$limit;
            $res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);


            $key_num = count($res['rows']);
            //print_r(formatWhere($where));
            $total_amount = db('demand')->alias('a')
                ->join('subject b','a.subject_id=b.subject_id','left')
                ->where(formatWhere($where))->sum('a.amount');

            $res['rows'][$key_num]['demand_id'] = '';
            $res['rows'][$key_num]['sn'] = '总计';
            $res['rows'][$key_num]['gender'] = '';
            $res['rows'][$key_num]['subject_id'] = '';
            $res['rows'][$key_num]['subject_name'] = '';
            $res['rows'][$key_num]['price'] = '';
            $res['rows'][$key_num]['province'] = '';
            $res['rows'][$key_num]['city'] = '';
            $res['rows'][$key_num]['area'] = '';
            $res['rows'][$key_num]['address'] = '';
            $res['rows'][$key_num]['gai_kuang'] = '';
            $res['rows'][$key_num]['teach_fee_id'] = '';
            $res['rows'][$key_num]['expense'] = '';
            $res['rows'][$key_num]['teach_time'] = '';
            $res['rows'][$key_num]['teacher_gender'] = '';
            $res['rows'][$key_num]['teacher_identity'] = '';
            $res['rows'][$key_num]['teacher_require'] = '';
            $res['rows'][$key_num]['linkman'] = '';
            $res['rows'][$key_num]['mobile'] = '';
            $res['rows'][$key_num]['mid'] = '';
            $res['rows'][$key_num]['create_time'] = '';
            $res['rows'][$key_num]['amount'] = $total_amount;
            $res['rows'][$key_num]['status'] = '';
            $res['rows'][$key_num]['is_real_pay'] = '';
            $res['rows'][$key_num]['is_refund'] = '';
            $res['rows'][$key_num]['is_hide'] = '';
            $res['rows'][$key_num]['refresh_time'] = '';


            return json($res);
        }
    }


    /*置顶*/
    function setStick(){
        if (!$this->request->isPost()){
            $demand_id = $this->request->get('demand_id','','serach_in');
            if(!$demand_id) $this->error('参数错误');
            $this->view->assign('info',checkData(DemandModel::find($demand_id)));
            return view('setStick');
        }else{
            $postField = 'demand_id,is_stick';
            $data = $this->request->only(explode(',',$postField),'post',null);

            if($data['is_stick']==1){
                $data['stick_time'] = time();
            }else{
                $data['stick_time'] = null;
            }

            $res = DemandService::setStick($data);
            return json(['status'=>'00','msg'=>'修改成功']);
        }
    }

    /*刷新*/
    function refreshDemand(){
        $idx =  $this->request->post('demand_id', '', 'serach_in');
        if(!$idx) $this->error('参数错误');
        try{
            $day_ref_info = db('day_refresh')->where('demand_id',$idx)->where('date', date('Y-m-d'))->find();
            if($day_ref_info){
                return json(['status' => 404, 'msg' => '您今日已刷新,不能再次刷新']);
            }

            db("demand")->where('demand_id', $idx)->update(['refresh_time'=>time()]);

            $ins['date'] = date('Y-m-d');
            $ins['mid'] = request()->uid;
            $ins['demand_id'] = $idx;
            //添加 今日刷新记录
            db('day_refresh')->insert($ins);

        }catch(\Exception $e){
            abort(config('my.error_log_code'),$e->getMessage());
        }
        return json(['status'=>'00','msg'=>'刷新成功']);
    }


    /*添加*/
    function add(){
        if (!$this->request->isPost()){
            return view('add');
        }else{
            $postField = 'name,age,gender,subject_id,price,province,city,area,address,gai_kuang,expense,teach_time,teacher_gender,teacher_identity,teacher_require,linkman,mobile,mid,create_time,sn,status,city,area,province,city,area,teach_fee_id,is_real_pay,amount,is_hide,refresh_time,is_refund,teaching_way,school,trial_time,category_id,grade_id,longitude,latitude,qrcode,poster';
            $data = $this->request->only(explode(',',$postField),'post',null);

            try {
                db()->startTrans();

                $res = DemandService::add($data);

                //如果手机号存在
                if($data['mobile']){
                    //查询改手机号有没有注册用户
                    $member_info = db('member')->where('mobile', $data['mobile'])->find();
                    $mid = $member_info['mid'];

                    //没有注册就默认注册
                    if(!$member_info){
                        $default_avatar = request()->domain().config('xhadmin.default_avatar');
                        $default_nickName = substr_replace($data['mobile'],'****',3,4);;

                        $ins['nickname']   = $default_nickName;
                        $ins['avatar']     = $default_avatar;
                        $ins['mobile']     = $data['mobile'];
                        $ins['create_time'] = time();
                        $ins['status']     = 1;
                        $mid = db('member')->insertGetId($ins);
                    }

                    db('demand')->where('demand_id',$res)->update(['mid'=>$mid]);
                }

                db()->commit();
            } catch (\Exception $e) {
                db()->rollback();
                abort(config('my.error_log_code'), $e->getMessage());
            }


            return json(['status'=>'00','msg'=>'添加成功']);
        }
    }

    /*修改*/
    function update(){
        if (!$this->request->isPost()){
            $demand_id = $this->request->get('demand_id','','serach_in');
            if(!$demand_id) $this->error('参数错误');
            $this->view->assign('info',checkData(DemandModel::find($demand_id)));
            return view('update');
        }else{
            $postField = 'demand_id,name,age,gender,subject_id,price,province,city,area,address,gai_kuang,expense,teach_time,teacher_gender,teacher_identity,teacher_require,linkman,mobile,mid,create_time,sn,status,order_id,city,area,province,city,area,teach_fee_id,is_real_pay,amount,is_hide,refresh_time,is_refund,teaching_way,school,trial_time,category_id,grade_id,longitude,latitude,qrcode,poster,ext_no,kefu_direct';
            $data = $this->request->only(explode(',',$postField),'post',null);

            //完成订单|1|primary,待上订单|0|success,关闭订单|2|danger
            try {
                db()->startTrans();

                $res = DemandService::update($data);

                //如果手机号存在
                if($data['mobile']){
                    //查询改手机号有没有注册用户
                    $member_info = db('member')->where('mobile', $data['mobile'])->find();
                    $mid = $member_info['mid'];

                    //没有注册就默认注册
                    if(!$member_info){
                        $default_avatar = request()->domain().config('xhadmin.default_avatar');
                        $default_nickName = substr_replace($data['mobile'],'****',3,4);;

                        $ins['nickname']   = $default_nickName;
                        $ins['avatar']     = $default_avatar;
                        $ins['mobile']     = $data['mobile'];
                        $ins['create_time'] = time();
                        $ins['status']     = 1;
                        $mid = db('member')->insertGetId($ins);
                    }

                    db('demand')->where('demand_id',$res['demand_id'])->update(['mid'=>$mid]);
                }

                db()->commit();
            } catch (\Exception $e) {
                db()->rollback();
                abort(config('my.error_log_code'), $e->getMessage());
            }

            return json(['status'=>'00','msg'=>'修改成功']);
        }
    }


    /*退款*/
    function refund(){
        $idx =  $this->request->post('demand_id', '', 'serach_in');
        if(!$idx) $this->error('参数错误');
        try{
            //查询 需求信息
            $demand_info = db('demand')->where('demand_id', $idx)->find();

            //is_real_pay  是否真的支付   是|1|primary,否|0|success
            if($demand_info['is_real_pay']==0){
                return json(['status'=>404,'msg'=>'该需求订单为直接发布订单,并未支付,无需退款']);
            }

            //is_refund 是否退款   是|1|primary,否|0|success
            if($demand_info['is_refund']==1){
                return json(['status'=>404,'msg'=>'该需求订单已退款']);
            }

            if($demand_info['status']==0){
                return json(['status'=>404,'msg'=>'该需求订单未支付']);
            }

            if($demand_info['status']==2){
                return json(['status'=>404,'msg'=>'该需求订单已完成,不能退款']);
            }

            //退款
            //商户订单号
            $data['out_trade_no'] = $demand_info['sn'];
            //订单金额
            $data['total_fee'] = $demand_info['amount'];
            //退款金额
            $data['refund_fee'] = $demand_info['amount'];
            //退款原因
            $data['desc'] = '后台退款';
            $res    = \utils\wechart\PayService::refund($data);

        }catch(\Exception $e){
            abort(config('my.error_log_code'),$e->getMessage());
        }


        //修改状态
        //is_refund 是否退款 是|1|primary,否|0|success
        //status 状态  待支付|0|success,已支付|1|primary,已完成|2|info,申请退款|3|danger
        db('demand')->where('demand_id', $idx)->update(['is_refund'=>1,'status'=>2]);

        return json(['status'=>'00','msg'=>'操作成功']);
    }


    /*end*/

    /**
     * 获取需求教师查看历史
     */
    function browseHistory(){
        $pageNum = $this->request->param('page_num', 1, 'intval');
        $pageSize = $this->request->param('page_size', 6, 'intval');
        $demand_id = $this->request->param('demand_id', '', 'intval');
        if(!$demand_id){
            $this->error('参数错误');
            $this->view->assign('info',[]);
            return view('browseHistory');
        }
        $where[] = ['demand_id', '=', $demand_id];
        $data = DemandViewRecordService::getDemandTeacherViewHistory($where, $pageNum, $pageSize);
        $this->view->assign('info',$data);
        return view('browseHistory');
    }

}

