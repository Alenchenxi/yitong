<?php 
/*
 module:		提现明细
 create_time:	2022-09-21 11:21:21
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\WithdrawService;
use app\admin\model\Withdraw as WithdrawModel;
use think\facade\Db;

class Withdraw extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['a.sn'] = ['like',$this->request->param('sn', '', 'serach_in')];

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['a.create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];
			$where['a.status'] = $this->request->param('status', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'withdraw_id desc';

			$sql = 'select a.*,b.nickname from cd_withdraw a left join cd_member b on a.mid=b.mid';
			$limit = ($page-1) * $limit.','.$limit;
			$res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);
			return json($res);
		}
	}

 /*start*/
	/*审核*/
	function updateStatus(){
		if (!$this->request->isPost()){
			$withdraw_id = $this->request->get('withdraw_id','','serach_in');
			if(!$withdraw_id) $this->error('参数错误');
			$this->view->assign('info',checkData(WithdrawModel::find($withdraw_id)));
			return view('updateStatus');
		}else{
			$postField = 'withdraw_id,status';
			$data = $this->request->only(explode(',',$postField),'post',null);


            $info = db('withdraw')->where('withdraw_id', $data['withdraw_id'])->find();
            if ($info['status'] != 0) {
                $this->error('该订单已不是待审核状态,不能再次操作');
            }

            try {
                if ($data['status'] == 1) {

                    //微信打款
                    $batch_name = '余额提现'; //转账的名称
                    $out_trade_no = $info['sn']; //单号
                    $total_fee = $info['amount'];//金额
                    $openid = db("member")->where("mid", $info['mid'])->value('openid');

                    $res = wxTiXian($batch_name, $out_trade_no, $total_fee, $openid);

                    if ($res['code'] == 'SYSTEM_ERROR' || $res['code'] == 'APPID_MCHID_NOT_MATCH' || $res['code'] == 'PARAM_ERROR' || $res['code'] == 'INVALID_REQUEST'
                        || $res['code'] == 'NO_AUTH' || $res['code'] == 'NOT_ENOUGH' || $res['code'] == 'ACCOUNTERROR' || $res['code'] == 'QUOTA_EXCEED' || $res['code'] == 'FREQUENCY_LIMITED') {
                        return json(['status' => '404', 'msg' => $res['message']]);
                    }

                    //修改 以体现金额
                    db("member")->where("mid", $info['mid'])->inc("withdrawn_amount", $info['amount'])->update();

                } elseif($data['status'] == 2) {
                    db('member')->where('mid', $info['mid'])->inc('amount', $info['amount'])->update();

                    //添加钱包流水
                    $inse['sn'] = doOrderSn(00);
                    $inse['mid'] = $info['mid'];
                    $inse['amount'] = $info['amount'];
                    $inse['type'] = 1;
                    $inse['remark'] = '申请提现驳回';
                    $inse['create_time'] = time();

                    db('wallet')->insert($inse);
                }

                $res = WithdrawService::updateStatus($data);

            } catch (\Exception $e) {
                $this->error($e->getMessage());
            }

			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}
    /*end*/



}

