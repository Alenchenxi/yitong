<?php 
/*
 module:		订单管理
 create_time:	2023-05-20 09:53:10
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\OrderService;
use app\admin\model\Order as OrderModel;
use think\facade\Db;

class Order extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');
			$where['teaching_way'] = $this->request->param('teaching_way', '', 'serach_in');
			$where['linkman'] = ['like',$this->request->param('linkman', '', 'serach_in')];
			$where['mobile'] = ['like',$this->request->param('mobile', '', 'serach_in')];

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'order_id,sn,mid,teacher_id,teaching_way,linkman,mobile,province,city,area,address,teaching_subject_id,grade_id,subject_id,grade_name,subject_name,price,hour,remain_hour,amount,weeks,create_time,status,pay_time';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'order_id desc';

			$res = OrderService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'sn,mid,demand_id,status,create_time,amount,pay_time,teacher_id,is_operation,refund_cause,type,teaching_way,linkman,mobile,province,city,area,address,teaching_subject_id,grade_id,subject_id,grade_name,subject_name,hour,weeks,price,remain_hour';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = OrderService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$order_id = $this->request->get('order_id','','serach_in');
			if(!$order_id) $this->error('参数错误');
			$this->view->assign('info',checkData(OrderModel::find($order_id)));
			return view('update');
		}else{
			$postField = 'order_id,sn,mid,demand_id,status,create_time,amount,pay_time,teacher_id,is_operation,refund_cause,type,teaching_way,linkman,mobile,province,city,area,address,teaching_subject_id,grade_id,subject_id,grade_name,subject_name,hour,weeks,price,remain_hour';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = OrderService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('order_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			OrderModel::destroy(['order_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

 /*start*/
	/*首页数据列表*/
    /*function index(){
        if (!$this->request->isAjax()){
            return view('index');
        }else{
            $limit  = $this->request->post('limit', 20, 'intval');
            $offset = $this->request->post('offset', 0, 'intval');
            $page   = floor($offset / $limit) +1 ;

            $where = [];
            $where['a.demand_id'] = $this->request->param('demand_id', '', 'serach_in');
            $where['b.sn'] = $this->request->param('demand_sn', '', 'serach_in');
            $where['a.teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');
            $where['a.status'] = $this->request->param('status', '', 'serach_in');

            $create_time_start = $this->request->param('create_time_start', '', 'serach_in');
            $create_time_end = $this->request->param('create_time_end', '', 'serach_in');

            $where['a.create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

            $pay_time_start = $this->request->param('pay_time_start', '', 'serach_in');
            $pay_time_end = $this->request->param('pay_time_end', '', 'serach_in');

            $where['a.pay_time'] = ['between',[strtotime($pay_time_start),strtotime($pay_time_end)]];
            $where['a.type'] = $this->request->param('type', '', 'serach_in');

            $order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
            $sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

            $field = '';
            $orderby = ($sort && $order) ? $sort.' '.$order : 'create_time desc';

            $sql = 'select a.*,b.sn as demand_sn from cd_order a left join cd_demand b on a.demand_id=b.demand_id';
            $limit = ($page-1) * $limit.','.$limit;
            $res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);

            return json($res);
        }
    }*/
	/*function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['sn'] = ['like',$this->request->param('sn', '', 'serach_in')];
			$where['status'] = $this->request->param('status', '', 'serach_in');

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$pay_time_start = $this->request->param('pay_time_start', '', 'serach_in');
			$pay_time_end = $this->request->param('pay_time_end', '', 'serach_in');

			$where['pay_time'] = ['between',[strtotime($pay_time_start),strtotime($pay_time_end)]];
			$where['type'] = $this->request->param('type', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'order_id,sn,mid,demand_id,teacher_id,amount,status,create_time,pay_time,refund_cause,type';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'pay_time desc,order_id desc';

			$res = OrderService::indexList(formatWhere($where),$field,$orderby,$limit,$page);

            $key_num = count($res['rows']);
            $status = $this->request->param('status', '', 'serach_in');

            if(!$status){
                $where['status'] = ['in',[1,2,4]];
            }
            //print_r(formatWhere($where));
            $total_amount = db('order')->where(formatWhere($where))->sum('amount');

            if($status && $status==0){
                $total_amount = 0;
            }

            if($status==3){
                $total_amount = 0;
            }

            $res['rows'][$key_num]['sn'] = '总计';
            $res['rows'][$key_num]['mid'] = '';
            $res['rows'][$key_num]['demand_id'] = '';
            $res['rows'][$key_num]['teacher_id'] = '';
            $res['rows'][$key_num]['amount'] = $total_amount;
            $res['rows'][$key_num]['status'] = '';
            $res['rows'][$key_num]['create_time'] = '';
            $res['rows'][$key_num]['pay_time'] = '';
            $res['rows'][$key_num]['refund_cause'] = '';
            $res['rows'][$key_num]['type'] = '';

            return json($res);
		}
	}*/



	/*修改*/
	/*function update(){
		if (!$this->request->isPost()){
			$order_id = $this->request->get('order_id','','serach_in');
			if(!$order_id) $this->error('参数错误');
			$this->view->assign('info',checkData(OrderModel::find($order_id)));
			return view('update');
		}else{
			$postField = 'order_id,sn,mid,demand_id,status,create_time,amount,pay_time,teacher_id,is_operation,refund_cause,type';
			$data = $this->request->only(explode(',',$postField),'post',null);

            $order_info = db('order')->where('order_id', $data['order_id'])->find();

            try {
                db()->startTrans();

                //status  待支付|0|primary,已支付|1|success,退款待审核|2|warning,已退款|3|danger,已完成|4|success
                //如果修改的状态 与 原状态不一样
                if($order_info['status']!=$data['status']){

                    //状态为 完成时
                    if($data['status']==4){
                        //修改需求
                        db('demand')->where('demand_id', $order_info['demand_id'])->update(['status'=>1,'teacher_id'=>$order_info['teacher_id']]);
                        //添加老师任教次数
                        db('teacher')->where('teacher_id', $order_info['teacher_id'])->inc('teach_num')->update();

                        //删除 其他 该需求的 预约订单
                        db('appointment')->where('demand_id',$order_info['demand_id'])->delete();
                        //删除 其他 该需求的 未完成的待付订单
                        db('order')->where('demand_id',$order_info['demand_id'])->where('order_id','<>',$order_info['order_id'])->where('status',0)->delete();
                        //修改其他 改需求的 未完成的 已支付订单
                        //支付订单
                        db('order')->where('demand_id',$order_info['demand_id'])->where('order_id','<>',$order_info['order_id'])->where('status',1)->where('type',1)->update(['status'=>2,'refund_cause'=>'订单已由其它教员完成','pay_time'=>time()]);
                        //助力订单
                        db('order')->where('demand_id',$order_info['demand_id'])->where('order_id','<>',$order_info['order_id'])->where('status',1)->where('type',2)->update(['status'=>4,'refund_cause'=>'订单已由其它教员完成','pay_time'=>time()]);
                    }

                    //状态为 申请退款时
                    if($data['status']==2){
                        //查询该用户的订单退单率
                        $teacher_info = db('teacher')->where('teacher_id', $order_info['teacher_id'])->find();
                        //后台设置 后多少单参与下线运算
                        $last_orders = config("config.last_orders");
                        //后台设置 参与下线运算 退款订单占比
                        $refund_order_prop = config("config.refund_order_prop");

                        //查询 未参与 下线指标的 订单总数
                        $wcy_order_num = db('order')->where('mid', $order_info['mid'])->where('is_operation', 0)->order('create_time desc')->count();

                        //如果未参与 下线指标的 订单总数  大于等于  后台设置的订单数 则计算
                        if($wcy_order_num>=$last_orders){
                            //参与运算的 退款订单数
                            $last_order_list = db('order')->where('mid', $order_info['mid'])->where('is_operation', 0)->order('create_time desc')->limit($last_orders)->select()->toArray();
                            //计算参与运算的后几单 中 申请退款的数量
                            $tk_count = 0;
                            foreach ($last_order_list as $k=>$v){
                                if($v['status']==2){
                                    $tk_count++;
                                }
                            }
                            //参与运算的 正常订单数
                            $zc_count = $last_orders-$tk_count;
                            //计算参与运算的订单 申请退款订单的占比
                            if($zc_count!=0){
                                $prop = ($tk_count/$zc_count)*100;
                            }else{
                                $prop = 0;
                            }

                            //如果比例大于后台设置 的占比 则将该用户老师账号 下线
                            if($prop>=$refund_order_prop){
                                //将老师的 状态改为 下线  添加老师下线次数
                                $offline_num = $teacher_info['offline_num']+1;
                                db('teacher')->where('teacher_id', $order_info['teacher_id'])->update(['is_on_off'=>2,'offline_num'=>$offline_num]);

                                //添加老师下线记录
                                $ins['mid'] = $teacher_info['mid'];
                                $ins['teacher_id'] = $teacher_info['teacher_id'];
                                $ins['teacher_name'] = $teacher_info['name'];
                                $ins['create_time'] = time();
                                db('offline')->insert($ins);
                            }
                        }
                    }


                    //状态为 退款时
                    if($data['status']==3){
                        //将购买的 记录状态 改为 已退款
                        db('teacher_stu')->where('teacher_id', $data['teacher_id'])
                            ->where('demand_id', $data['demand_id'])->update(['status'=>2]);

                        //退款
                        //商户订单号
                        $data['out_trade_no'] = $order_info['sn'];
                        //订单金额
                        $data['total_fee'] = $order_info['amount'];
                        //退款金额
                        $data['refund_fee'] = $order_info['amount'];
                        //退款原因
                        $data['desc'] = '退款审核通过';
                        $res    = \utils\wechart\PayService::refund($data);

                        //退款成功
                        if($res['return_code']=='SUCCESS' && $res['result_code']=='SUCCESS'){

                        }

                    }

                    //当状态不同时 记录操作时间  pay_time 操作时间, 修改操作时间
                    $data['pay_time'] = date('Y-m-d H:i:s');
                }

                $res = OrderService::update($data);


                db()->commit();
            } catch (\Exception $e) {
                db()->rollback();
                abort(config('my.error_log_code'), $e->getMessage());
            }

			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}*/
    /*end*/



}

