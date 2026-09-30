<?php

return [
	'alias' => [
		'JwtAuth'	=>	app\ApplicationName\middleware\JwtAuth::class,
		'SmsAuth'	=>	app\ApplicationName\middleware\SmsAuth::class,
		'CaptchaAuth'=>	app\ApplicationName\middleware\CaptchaAuth::class,
	],	
];
